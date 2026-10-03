// Pure kart physics — no React, no three. Operates on a plain mutable state
// object so it is identical for the player and all AI, and unit-testable.
// Conventions (shared with AIController): forward = (-sin h, 0, -cos h);
// steer > 0 turns LEFT (heading increases). Position is XZ; Y comes from the
// ground sampler in the controller, not here.
import { DRIFT_TIERS } from "./kartTuning";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Framerate-independent exponential approach (same shape as three's damp).
const damp = (x, target, lambda, dt) => x + (target - x) * (1 - Math.exp(-lambda * dt));

export function createKartState(x = 0, z = 0, heading = 0) {
  return {
    px: x, py: 0, pz: z,
    heading,
    speed: 0,
    driftDir: 0,     // 0 none, +1 left, -1 right
    driftTime: 0,
    driftTier: 0,    // 0..3 live charge tier (for spark color)
    turbo: 0,        // remaining boost seconds
    boostFlash: 0,   // brief flag right after a boost fires
    stunTime: 0,
    spin: 0,         // involuntary yaw rate from a FUD hit (rad/s)
    airTime: 0,
    vy: 0,
    yHop: 0,         // vertical hop offset added on top of ground Y
    wasJump: false,
  };
}

function liveTier(driftTime) {
  let tier = 0;
  for (let i = DRIFT_TIERS.length - 1; i >= 1; i--) {
    if (driftTime >= DRIFT_TIERS[i]) { tier = i; break; }
  }
  return tier;
}

// mod: optional FUN-effect modifiers { speedMult, accelMult, handlingMult }.
export function stepKart(st, input, tune, dt, mod = {}) {
  const speedMult = mod.speedMult ?? 1;
  const accelMult = mod.accelMult ?? 1;
  const handlingMult = mod.handlingMult ?? 1;

  if (st.stunTime > 0) st.stunTime = Math.max(0, st.stunTime - dt);
  if (st.turbo > 0) st.turbo = Math.max(0, st.turbo - dt);
  if (st.boostFlash > 0) st.boostFlash = Math.max(0, st.boostFlash - dt);
  if (st.spin !== 0) {
    const decay = 2.5 + tune.recovery * 3.5;
    st.spin -= st.spin * Math.min(1, decay * dt);
    if (Math.abs(st.spin) < 0.03) st.spin = 0;
  }

  const stunned = st.stunTime > 0;
  const throttle = stunned ? 0.2 : clamp(input.throttle ?? 0, -1, 1);
  const steerIn = stunned ? 0 : clamp(input.steer ?? 0, -1, 1);

  // ---- longitudinal ----
  const boosting = st.turbo > 0;
  const topSpeed = tune.maxSpeed * speedMult + (boosting ? tune.boostSpeedAdd : 0);
  let target;
  if (throttle >= 0) target = topSpeed * throttle;
  else target = st.speed > 1 ? 0 : tune.reverseMax * throttle;
  const braking = throttle < 0 && st.speed > 1;
  const rate = (braking ? tune.brake : tune.accel) * accelMult;
  st.speed = damp(st.speed, target, rate, dt);

  // ---- drift / hop state machine ----
  const canDrift = !stunned && st.speed > tune.maxSpeed * 0.4 && st.airTime <= 0;
  const jumpEdge = input.jump && !st.wasJump;
  if (jumpEdge && st.airTime <= 0) {
    st.airTime = 0.28;
    st.vy = 6.5;
    if (canDrift && Math.abs(steerIn) > 0.2) st.driftDir = steerIn > 0 ? 1 : -1;
  }
  if (input.jump && st.driftDir !== 0 && canDrift) {
    st.driftTime += dt;
    st.driftTier = liveTier(st.driftTime);
  }
  if (!input.jump && st.driftDir !== 0) {
    const tier = liveTier(st.driftTime);
    if (tier > 0) { st.turbo = Math.max(st.turbo, tune.boostDuration * tier); st.boostFlash = 0.4; }
    st.driftDir = 0; st.driftTime = 0; st.driftTier = 0;
  }
  if (st.speed < tune.maxSpeed * 0.25) { st.driftDir = 0; st.driftTime = 0; st.driftTier = 0; }

  // ---- steering ----
  const speedFrac = clamp(st.speed / tune.maxSpeed, 0, 1.2);
  let turn = steerIn * tune.turnRate * handlingMult;
  if (st.driftDir !== 0) turn += st.driftDir * tune.driftTurnBonus;
  st.heading += turn * speedFrac * dt;
  st.heading += st.spin * dt;

  // ---- vertical hop ----
  if (st.airTime > 0) {
    st.airTime -= dt;
    st.vy -= 20 * dt;
    st.yHop = Math.max(0, st.yHop + st.vy * dt);
    if (st.airTime <= 0) { st.yHop = 0; st.vy = 0; }
  }

  // ---- integrate ----
  const fx = -Math.sin(st.heading);
  const fz = -Math.cos(st.heading);
  st.px += fx * st.speed * dt;
  st.pz += fz * st.speed * dt;

  st.wasJump = !!input.jump;
  st.steer = steerIn;   // recorded for visuals (front-wheel yaw, lean)
  st.throttle = throttle;
  return st;
}

export function forwardVec(heading) {
  return [-Math.sin(heading), 0, -Math.cos(heading)];
}

// Apply a FUD collision. awayDir is a world unit vector [x,0,z] pointing from the
// FUD toward the kart (knockback direction). Returns true if it landed.
export function applyFudHit(st, penalty, tune, awayDir) {
  st.speed *= penalty.speedMult;
  const stun = (penalty.stunMs / 1000) * tune.stunMult;
  st.stunTime = Math.max(st.stunTime, stun);
  if (penalty.spin > 0) {
    st.spin += (Math.random() < 0.5 ? -1 : 1) * penalty.spin * 3 * tune.knockMult;
  }
  const k = penalty.knockback * tune.knockMult;
  if (awayDir) { st.px += awayDir[0] * k; st.pz += awayDir[2] * k; }
  st.turbo = 0;
  return true;
}

// FUN "repair": clear stun/spin and give a small launch.
export function applyRecovery(st) {
  st.stunTime = 0;
  st.spin = 0;
}

export { clamp, damp };
