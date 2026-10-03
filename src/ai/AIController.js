// AIController.js
// =============================================================================
// AI DRIVER "BRAIN" for "Dodge the FUD" (pure logic; no React, no three.js).
//
// CONTROL MODEL (per frame, O(1)):
//   1. Localize: project the kart onto the nearest racing-line segment, searching
//      a small window around our own last index (robust to a stale caller index
//      and the closed-loop wrap).
//   2. Steer: pick a lookahead point on the line (distance scales with speed and
//      `foresight`), bias it laterally within the track for apex clipping
//      (`cornering`/`lineRisk`), then steer by the signed heading error. The
//      heading convention forward=(-sin h,-cos h) means a positive heading error
//      maps to a positive (LEFT) steer — see aiMath.headingOf.
//   3. Throttle: scan upcoming curvature, derive a safe corner speed, and brake
//      early enough to reach it (`cornerEntryBrake`); full throttle on straights
//      up to a difficulty/skill-capped cruise speed.
//   4. Drift (jump): engage on sharp, fast corners with hysteresis.
//   5. Avoid: nudge the lateral target around hazards / close opponents.
//   6. Item: loose aggression-gated heuristic.
//   7. Human factors: difficulty + consistency drive steering lag, noise,
//      occasional mistakes, and subtle rubber-banding. A per-id PRNG makes each
//      driver varied but deterministic within an instance.
// =============================================================================

import {
  clamp, lerp, ramp, wrapAngle, headingOf, fwdX, fwdZ, makePRNG, hashString,
} from "./aiMath.js";

/** Read a 0..1-ish numeric field with a fallback. */
function num(v, d) {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

// -----------------------------------------------------------------------------
// TUNABLES. A later difficulty sweep edits these with confidence. Each knob says
// what RAISING it does. Per-personality skill and the global `difficulty` scale
// most of these at runtime; the values here are the baselines.
// -----------------------------------------------------------------------------
const T = {
  // Steering
  steerGain: 2.0,          // heading-error (rad) -> steer; higher = sharper
  steerTauFast: 0.045,     // steering low-pass time const at difficulty 1 (s)
  steerTauSlow: 0.18,      // ...at difficulty 0 (laggier, more human)

  // Lookahead (steering target), world units
  lookBase: 9,             // minimum lookahead
  lookPerSpeed: 0.40,      // added per unit of speed
  lookMin: 8,
  lookMax: 46,

  // Racing line / apex
  curvRef: 0.050,          // curvature (1/radius) treated as a "full" corner
  edgeSafety: 0.82,        // never target beyond this fraction of halfWidth

  // Throttle / corner braking
  latAccelBase: 118,       // base max lateral accel (u/s^2) -> safe corner speed
  brakeDecel: 78,          // assumed braking decel used for look-ahead (u/s^2)
  cornerSpeedMin: 14,      // floor on computed safe corner speed
  cruiseFloor: 0.80,       // min cruise fraction of maxSpeed (at difficulty 0)
  brakeLookMax: 95,        // max arc distance scanned for upcoming corners

  // Drift
  driftEnterCurv: 0.022,   // curvature above which a drift is worthwhile
  driftExitCurv: 0.013,    // hysteresis: release the drift below this
  driftMinSpeedFrac: 0.45, // need this fraction of maxSpeed to drift

  // Avoidance
  hazardMargin: 3.0,       // extra clearance beyond a hazard's radius (units)
  hazardLook: 42,          // only react to hazards within this forward distance
  opponentLook: 16,        // "about to rear-end" distance to an opponent ahead
  opponentRadius: 4.5,     // lateral clearance to a close opponent

  // Human factors
  mistakeDurMin: 0.3,      // seconds a triggered mistake lasts
  mistakeDurMax: 0.8,
  noiseTau: 0.5,           // steering-noise wander time const (s)
  rubberBandMax: 0.085,    // max fractional cruise boost for a trailing AI
};

/**
 * Create an AI driver controller.
 * @param {object}   cfg
 * @param {object}   cfg.personality  entry from theme.aiPersonalities
 * @param {number}  [cfg.difficulty]  0..1 master competence knob (default 0.65)
 * @param {Array}    cfg.racingLine   [[x,y,z,halfWidth], ...] closed loop
 * @param {Array}   [cfg.racingNormals] [[nx,nz], ...] left-hand unit normals
 */
export function createAIController({
  personality,
  difficulty = 0.65,
  racingLine,
  racingNormals,
}) {
  const diff = clamp(num(difficulty, 0.65), 0, 1);
  const p = personality || {};
  const skill = p.skill || {};
  const beh = p.behavior || {};
  // Per-driver skills / behaviors (all 0..1), with safe defaults.
  const sSpeed = num(skill.speed, 0.6);
  const sCorner = num(skill.cornering, 0.6);
  const sAggr = num(skill.aggression, 0.6);
  const sConsist = num(skill.consistency, 0.6);
  const sForesight = num(skill.foresight, 0.6);
  const bBrake = num(beh.cornerEntryBrake, 0.7);
  const bLineRisk = num(beh.lineRisk, 0.6);
  const bMistake = num(beh.mistakeChance, 0.08);
  const bOvertake = num(beh.overtakeDrive, 0.6);

  // ---- Precompute track geometry ONCE (never in the hot path) ----
  const N = racingLine.length;
  const px = new Float64Array(N), pz = new Float64Array(N), half = new Float64Array(N);
  for (let i = 0; i < N; i++) { const w = racingLine[i]; px[i] = w[0]; pz[i] = w[2]; half[i] = w[3]; }
  // Normalized segment directions i -> i+1 and their lengths.
  const sdx = new Float64Array(N), sdz = new Float64Array(N), slen = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; const dx = px[j] - px[i], dz = pz[j] - pz[i];
    const l = Math.hypot(dx, dz) || 1e-6; sdx[i] = dx / l; sdz[i] = dz / l; slen[i] = l;
  }
  // Left-hand normals: use provided ones, else (-tz, tx) of the central-diff
  // tangent (the generator's convention).
  const nx = new Float64Array(N), nz = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (racingNormals && racingNormals[i]) { nx[i] = racingNormals[i][0]; nz[i] = racingNormals[i][1]; }
    else {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      const tx = px[b] - px[a], tz = pz[b] - pz[a], l = Math.hypot(tx, tz) || 1e-6;
      nx[i] = -tz / l; nz[i] = tx / l;
    }
  }
  // Signed curvature per waypoint: turn angle between incoming/outgoing segment
  // over local arc length. Sign > 0 => the path curves toward its LEFT normal
  // (CCW), i.e. the apex/inside lies in the +normal direction.
  const curv = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const pI = (i - 1 + N) % N;
    const d = wrapAngle(Math.atan2(sdz[i], sdx[i]) - Math.atan2(sdz[pI], sdx[pI]));
    curv[i] = d / ((slen[pI] + slen[i]) * 0.5);
  }

  // ---- Per-instance mutable state ----
  const seed = hashString(String(p.id || "ai") + ":" + N);
  let rand = makePRNG(seed);
  let segIdx = 0;        // segment the kart is currently on (our own tracking)
  let segT = 0;          // 0..1 position along that segment
  let prevSegIdx = 0;
  let inited = false;
  let steerState = 0;    // low-passed steering output
  let noiseState = 0;    // slow steering-noise wander
  let drifting = false;  // drift hysteresis flag
  let mistakeTimer = 0;  // seconds remaining on an active mistake
  let mistakeKind = 0;   // 0 none | 1 wide line | 2 missed brake | 3 steer twitch
  let lapCount = 0;      // completed loops (debug/info)

  // Reusable scratch to avoid per-frame allocation.
  const out = { throttle: 0, steer: 0, jump: false, item: false };
  const look = { x: 0, z: 0, i: 0, t: 0 };

  // Project the kart onto the nearest segment within a small window around the
  // last known index. O(1); handles the loop wrap and a stale caller hint.
  function updateSegment(posX, posZ, hint) {
    let base = segIdx;
    if (!inited && typeof hint === "number") base = ((hint % N) + N) % N;
    let bestI = base, bestT = segT, bestD = Infinity;
    for (let k = -2; k <= 6; k++) {
      const i = ((base + k) % N + N) % N;
      const wx = posX - px[i], wz = posZ - pz[i];
      let proj = wx * sdx[i] + wz * sdz[i];
      if (proj < 0) proj = 0; else if (proj > slen[i]) proj = slen[i];
      const cx = px[i] + sdx[i] * proj, cz = pz[i] + sdz[i] * proj;
      const dx = posX - cx, dz = posZ - cz, d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; bestI = i; bestT = proj / slen[i]; }
    }
    if (prevSegIdx === N - 1 && bestI === 0) lapCount++; // forward wrap
    prevSegIdx = bestI; segIdx = bestI; segT = bestT;
  }

  // Walk forward `dist` units along the line from (segIdx, segT); fill `dst`.
  function pointAhead(dist, dst) {
    let i = segIdx, along = segT * slen[i] + dist, guard = 0;
    while (along > slen[i] && guard++ < N) { along -= slen[i]; i = (i + 1) % N; }
    dst.x = px[i] + sdx[i] * along;
    dst.z = pz[i] + sdz[i] * along;
    dst.i = i; dst.t = clamp(along / slen[i], 0, 1);
  }

  // Speed limit the kart should be AT NOW so it can brake in time for the
  // sharpest corner within `brakeLookMax`. v_safe(k)=sqrt(latAccel/k); then back
  // off by distance using v = sqrt(v_safe^2 + 2*decel*dist).
  function speedLimitAhead(maxSpeed, latAccel, decel) {
    let limit = maxSpeed, i = segIdx, dist = (1 - segT) * slen[i], guard = 0;
    while (dist < T.brakeLookMax && guard++ < N) {
      i = (i + 1) % N;
      const k = Math.abs(curv[i]);
      if (k > 1e-4) {
        const vCorner = Math.max(T.cornerSpeedMin, Math.sqrt(latAccel / k));
        const vAllow = Math.sqrt(vCorner * vCorner + 2 * decel * dist);
        if (vAllow < limit) limit = vAllow;
      }
      dist += slen[i];
    }
    return limit;
  }

  function computeInput(ctx) {
    const self = ctx.self || {};
    const pos = self.position || [0, 0, 0];
    const posX = pos[0], posZ = pos[2];
    const heading = num(self.heading, 0);
    const speed = num(self.speed, 0);
    const maxSpeed = num(self.maxSpeed, 60);
    const dt = ctx.dt > 0 ? ctx.dt : 1 / 60;
    const raceProgress = clamp(num(ctx.raceProgress, 0), 0, 1);
    const rank = num(ctx.rank, 1);

    updateSegment(posX, posZ, self.currentWaypoint);
    inited = true;

    // ---- Human factors: difficulty-scaled competence (0..1) ----
    const competence = clamp(diff * (0.7 + 0.3 * sConsist), 0, 1);

    // Mistake trigger. Rate scaled DOWN by difficulty & consistency.
    if (mistakeTimer > 0) {
      mistakeTimer -= dt;
    } else if (!self.stunned) {
      const rate = bMistake * (1 - 0.75 * diff) * (1 - 0.5 * sConsist);
      if (rand() < rate * dt * 2.0) {
        mistakeTimer = lerp(T.mistakeDurMin, T.mistakeDurMax, rand());
        mistakeKind = 1 + ((rand() * 3) | 0);
      }
    }
    const mistaking = mistakeTimer > 0;

    // Slow steering noise (hands not perfectly steady); larger at low competence.
    const noiseAmp = (1 - competence) * 0.16;
    noiseState = lerp(noiseState, (rand() * 2 - 1) * noiseAmp, clamp(dt / T.noiseTau, 0, 1));

    // ---- Rubber-banding (subtle): trailing AI push harder late; elite,
    // high-consistency drivers barely rubber-band. ----
    const trail = clamp((rank - 1) / 4, 0, 1);
    const rubber = T.rubberBandMax * trail * raceProgress * (1 - 0.6 * sConsist);

    // ---- Steering target: lookahead point on the racing line ----
    const foresightK = 0.55 + 0.55 * sForesight; // more foresight -> look further
    const Ld = clamp((T.lookBase + T.lookPerSpeed * speed) * foresightK, T.lookMin, T.lookMax);
    pointAhead(Ld, look);

    // Corner read at the lookahead waypoint (for apex + drift decisions).
    const kHere = curv[look.i];
    const sharp = clamp(Math.abs(kHere) / T.curvRef, 0, 1);
    const apexSign = kHere >= 0 ? 1 : -1; // +normal is the inside for CCW corners

    // Lateral offset as a fraction of halfWidth. Clip the apex on corners; the
    // bias grows with cornering skill, lineRisk and competence. Low skill -> a
    // smaller bias -> a wider, sloppier line. A mistake runs the line wide.
    let frac = apexSign * sharp *
      (0.15 + 0.55 * sCorner + 0.35 * bLineRisk) * (0.5 + 0.5 * competence);
    if (mistaking && mistakeKind === 1) frac = -apexSign * sharp * 0.5;

      // Forward and the kart's LEFT unit vector (d/dh of forward): left=(-cos,sin).
    const fX = fwdX(heading), fZ = fwdZ(heading);
    const leftX = -Math.cos(heading), leftZ = Math.sin(heading);

    // ---- Hazard avoidance (folded into the lateral target) ----
    const hazards = ctx.hazards;
    if (hazards && hazards.length) {
      for (let h = 0; h < hazards.length; h++) {
        const hz = hazards[h], hp = hz.position;
        const rx = hp[0] - posX, rz = hp[2] - posZ;
        const ahead = rx * fX + rz * fZ;
        if (ahead <= 0 || ahead > T.hazardLook) continue;
        const lateral = rx * leftX + rz * leftZ;          // + => hazard on left
        const clear = num(hz.radius, 2) + T.hazardMargin;
        if (Math.abs(lateral) > clear) continue;          // we already miss it
        const prox = ramp(T.hazardLook - ahead, 0, T.hazardLook) *
          ramp(clear - Math.abs(lateral), 0, clear);
        // Dodge away from the hazard; if dead-ahead, go to the corner's outside.
        const dir = lateral > 0.4 ? -1 : lateral < -0.4 ? 1 : -apexSign;
        frac += dir * prox * (0.45 + 0.55 * sForesight) * 0.8;
      }
    }

    // ---- Opponent awareness (mild) ----
    const opps = ctx.opponents;
    let blockedAhead = false;
    if (opps && opps.length) {
      for (let o = 0; o < opps.length; o++) {
        const op = opps[o], oq = op.position;
        const rx = oq[0] - posX, rz = oq[2] - posZ;
        const ahead = rx * fX + rz * fZ;
        if (ahead <= 0 || ahead > T.opponentLook) continue;
        const lateral = rx * leftX + rz * leftZ;
        if (Math.abs(lateral) > T.opponentRadius) continue;
        blockedAhead = true;
        // Overtakers commit to a side; everyone eases off (handled in throttle).
        const dir = lateral >= 0 ? -1 : 1;
        const drive = 0.25 + 0.6 * bOvertake;
        frac += dir * drive * ramp(T.opponentLook - ahead, 0, T.opponentLook) * 0.5;
      }
    }

    frac = clamp(frac, -T.edgeSafety, T.edgeSafety);

    // World-space target: centerline lookahead + interpolated normal * offset.
    const j = (look.i + 1) % N, tt = look.t;
    let onx = lerp(nx[look.i], nx[j], tt), onz = lerp(nz[look.i], nz[j], tt);
    const nl = Math.hypot(onx, onz) || 1e-6; onx /= nl; onz /= nl;
    const hw = lerp(half[look.i], half[j], tt);
    const tgtX = look.x + onx * frac * hw;
    const tgtZ = look.z + onz * frac * hw;

    // ---- Steering: signed heading error toward the target ----
    const errRaw = wrapAngle(headingOf(tgtX - posX, tgtZ - posZ) - heading);
    const steerCmd = clamp(errRaw * T.steerGain, -1, 1);
    const steerTau = lerp(T.steerTauSlow, T.steerTauFast, competence);
    steerState = lerp(steerState, steerCmd, clamp(dt / steerTau, 0, 1));
    const twitch = mistaking && mistakeKind === 3 ? (rand() * 2 - 1) * 0.3 : 0;
    const steer = clamp(steerState + noiseState + twitch, -1, 1);

      // ---- Stunned: just point at the line and floor it to recover. ----
    if (self.stunned) {
      out.throttle = 1; out.steer = steer; out.jump = false; out.item = false;
      return out;
    }

    // ---- Throttle & corner braking ----
    // Max lateral accel the driver dares (skill + difficulty); harder/earlier
    // braking for high cornerEntryBrake drivers.
    const latAccel = T.latAccelBase * (0.55 + 0.45 * sCorner) * (0.7 + 0.3 * diff);
    const decel = T.brakeDecel * (0.6 + 0.5 * bBrake) * (0.7 + 0.3 * competence);
    const vLimit = speedLimitAhead(maxSpeed, latAccel, decel);

    // Cruise cap: lower target at low difficulty / speed-skill, plus a little
    // rubber-band when trailing late.
    const cruiseFrac = clamp(
      lerp(T.cruiseFloor, 1.0, diff) * (0.9 + 0.1 * sSpeed) + rubber, 0.5, 1.05);
    const vCruise = maxSpeed * cruiseFrac;
    let vTarget = Math.min(vLimit, vCruise);
    if (blockedAhead) vTarget = Math.min(vTarget, speed * 0.9); // don't rear-end
    if (mistaking && mistakeKind === 2) vTarget = vCruise;      // missed brake

    let throttle;
    if (speed > vTarget + 0.5) throttle = clamp((vTarget - speed) / 8, -1, 0);
    else if (speed < vTarget - 0.5) throttle = 1;
    else throttle = 0.25;

    // ---- Drift (jump): sharp, fast corners, with hysteresis so it holds through
    // the corner and releases on exit. Gated by cornering skill / lineRisk. ----
    const curCurv = Math.abs(curv[segIdx]);
    const driftWilling = (sCorner * 0.6 + bLineRisk * 0.4) > 0.4 && diff > 0.3;
    if (drifting) {
      if (curCurv < T.driftExitCurv || speed < maxSpeed * 0.3) drifting = false;
    } else if (
      driftWilling && curCurv > T.driftEnterCurv &&
      speed > maxSpeed * T.driftMinSpeedFrac && Math.abs(steer) > 0.25
    ) {
      drifting = true;
    }

    // ---- Item use: loose, aggression-gated heuristic ----
    let item = false;
    if (self.hasItem) {
      const straight = curCurv < T.driftEnterCurv && vLimit > maxSpeed * 0.9;
      const wantBoost = straight && (rank >= 3 || raceProgress > 0.7);
      if ((wantBoost || blockedAhead) && rand() < 0.3 + 0.7 * sAggr) item = true;
    }

    out.throttle = throttle; out.steer = steer; out.jump = drifting; out.item = item;
    return out;
  }

  function reset() {
    rand = makePRNG(seed);
    segIdx = 0; segT = 0; prevSegIdx = 0; inited = false;
    steerState = 0; noiseState = 0; drifting = false;
    mistakeTimer = 0; mistakeKind = 0; lapCount = 0;
  }

  return {
    reset,
    computeInput,
    /** Completed loops so far (debug/telemetry). */
    laps: () => lapCount,
  };
}

export default createAIController;






