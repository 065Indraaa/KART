// RaceManager — mounts the 5 karts, spawns Tapcoins/FUN/FUD from trackData,
// drives the countdown, tracks laps/checkpoints/positions, runs collision, and
// fires VFX + audio. The single place that turns kart motion into a "race".
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { KartController } from "../karts/KartController";
import { useGroundSampler } from "../karts/useGroundSampler";
import { allKarts, getKart, clearRegistry } from "../karts/kartRegistry";
import { applyFudHit, applyRecovery } from "../karts/kartPhysics";
import { Tapcoin } from "../objects/Tapcoin";
import { FunBox } from "../objects/FunBox";
import { Fud } from "../objects/Fud";
import { coinBurst, funBurst, fudBurst } from "../objects/vfxBursts";
import { racingLine, racingNormals, coinSpawns, funSpawns, fudSpawns } from "../trackData";
import { useRace, PHASE } from "../raceStore";
import { useProgress } from "../progressStore";
import { aiRoster, aiPersonalities, characters as charDefs, fudTypes, funRollTable } from "../theme";
import * as audio from "../audio/audioManager";

const N = racingLine.length;
const FUD_RADIUS = { wall: 3.6, cluster: 3.0, gate: 2.8, default: 2.2 };
const COIN_PICK = 3.0;
const FUN_PICK = 3.2;
const FUN_RESPAWN = 6;

export function RaceManager({ difficulty = 0.65 }) {
  const selectedKart = useProgress((s) => s.selectedKart);
  const selectedCharacter = useProgress((s) => s.selectedCharacter);
  const upgrades = useProgress((s) => s.upgrades);
  const addTapcoins = useProgress((s) => s.addTapcoins);
  const recordResult = useProgress((s) => s.recordResult);
  const phase = useRace((s) => s.phase);
  const [, getKeys] = useKeyboardControls();

  const groundSampler = useGroundSampler();
  const hazardsRef = useRef([]);
  // The player kart's tuning (passives) is needed when items resolve and when
  // the race ends; the controller registers it via kartRegistry.
  const playerTuneRef = useRef(null);
  const [roster, setRoster] = useState([]);
  const [grid, setGrid] = useState([]);
  const [raceKey, setRaceKey] = useState(0);
  const [coinTaken, setCoinTaken] = useState([]);
  const [funVisible, setFunVisible] = useState([]);
  const coinTakenRef = useRef([]);
  const funVisibleRef = useRef([]);
  const funTakenRef = useRef([]);
  const fudGroupRefs = useRef([]);
  const prog = useRef(new Map());
  const hitCd = useRef(new Map());
  const prevItem = useRef(false);
  const builtRef = useRef(false);
  const finishScheduled = useRef(false);
  const timers = useRef([]);

  const fudData = useMemo(
    () => fudSpawns.map((f) => ({
      ...f,
      normal: racingNormals[f.waypoint] || [1, 0],
      radius: FUD_RADIUS[f.type] || FUD_RADIUS.default,
    })),
    []
  );

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  function persistAndShow() {
    const race = useRace.getState();
    const res = race.results;
    if (res) {
      const char = charDefs[selectedCharacter] || charDefs.satoshi;
      const earned = Math.round(res.coins * 10 * (1 + (char.passive.tapcoinBonus || 0))) + (6 - res.place) * 40;
      addTapcoins(Math.max(0, earned));
      recordResult({ name: "YOU", score: res.score, time: res.timeMs });
    }
    audio.stopMusic?.();
    useRace.getState().setPhase(PHASE.RESULTS);
  }

  function runCountdown() {
    useRace.getState().setCountdown(3);
    audio.play?.("countdownBeep");
    [2, 1].forEach((n, idx) => {
      timers.current.push(setTimeout(() => { useRace.getState().setCountdown(n); audio.play?.("countdownBeep"); }, (idx + 1) * 1000));
    });
    timers.current.push(setTimeout(() => {
      useRace.getState().setCountdown(0);
      audio.play?.("countdownGo");
      useRace.getState().setPhase(PHASE.RACING);
      audio.playMusic?.("main");
    }, 3000));
    timers.current.push(setTimeout(() => useRace.getState().setCountdown(null), 4000));
  }

  function startRace() {
    const r = buildRoster(selectedKart, selectedCharacter, upgrades);
    const g = buildStartGrid(r.length);
    r.forEach((racer) =>
      useRace.getState().registerRacer({ id: racer.id, name: racer.name, isPlayer: racer.isPlayer, kart: racer.kart, character: racer.character })
    );
    prog.current = new Map();
    r.forEach((racer, i) => {
      const p = projectToLine(g[i].x, g[i].z, N - 2);
      prog.current.set(racer.id, { seg: p.seg, station: p.station, lap: 0, passedHalf: false, finished: false });
    });
    hitCd.current = new Map();
    coinTakenRef.current = coinSpawns.map(() => false);
    funVisibleRef.current = funSpawns.map(() => true);
    funTakenRef.current = funSpawns.map(() => 0);
    finishScheduled.current = false;
    setCoinTaken(coinTakenRef.current.slice());
    setFunVisible(funVisibleRef.current.slice());
    setRoster(r);
    setGrid(g);
    setRaceKey((k) => k + 1);
    audio.preload?.();
    runCountdown();
  }

  function teardown() { clearTimers(); clearRegistry(); setRoster([]); setGrid([]); }

  useEffect(() => {
    if (phase === PHASE.COUNTDOWN && !builtRef.current) { builtRef.current = true; startRace(); }
    else if (phase === PHASE.MENU || phase === PHASE.GARAGE) { builtRef.current = false; teardown(); }
    else if (phase === PHASE.RESULTS) { builtRef.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  function updateHazards(now, px, pz) {
    const arr = hazardsRef.current;
    for (let i = 0; i < fudData.length; i++) {
      const f = fudData[i];
      let x = f.position[0], y = f.position[1], z = f.position[2];
      const nx = f.normal[0], nz = f.normal[1];
      let active = true;
      if (f.type === "moving") { const o = Math.sin(now * 1.2 + i) * 7; x += nx * o; z += nz * o; }
      else if (f.type === "gate") { const o = Math.sin(now * 0.8 + i) * 9; x += nx * o; z += nz * o; }
      else if (f.type === "falling") { y += Math.max(0, Math.sin(now * 1.5 + i)) * 2.5; }
      else if (f.type === "ambush") {
        const d2 = (px - x) ** 2 + (pz - z) ** 2;
        active = d2 < (f.triggerRadius ? f.triggerRadius * f.triggerRadius : 144);
      }
      // Keep hazards glued to the drivable surface: the track data's Y can be
      // stale after a line refinement, so re-sample ground under each FUD.
      const gy = groundSampler.sampleGroundY(x, z, y);
      y = gy;
      const g = fudGroupRefs.current[i];
      if (g) { g.position.set(x, y, z); g.visible = active; }
      arr[i] = { position: [x, y, z], radius: f.radius, type: f.type, active };
    }
  }

  function runCollisions(race) {
    const pk = getKart(race.playerId || "player");
    if (!pk) return;
    const px = pk.position[0], pz = pk.position[2];

    for (let i = 0; i < coinSpawns.length; i++) {
      if (coinTakenRef.current[i]) continue;
      const c = coinSpawns[i];
      if ((px - c[0]) ** 2 + (pz - c[2]) ** 2 < COIN_PICK * COIN_PICK) {
        coinTakenRef.current[i] = true;
        setCoinTaken(coinTakenRef.current.slice());
        const mult = race.activeEffects.some((e) => e.type === "tapcoinMult") ? 2 : 1;
        useRace.getState().collectCoin(mult);
        coinBurst(c); audio.play?.("coin");
      }
    }

    for (let i = 0; i < funSpawns.length; i++) {
      if (!funVisibleRef.current[i]) {
        if (race.raceTime - funTakenRef.current[i] > FUN_RESPAWN) {
          funVisibleRef.current[i] = true;
          setFunVisible(funVisibleRef.current.slice());
        }
        continue;
      }
      const f = funSpawns[i];
      if ((px - f[0]) ** 2 + (pz - f[2]) ** 2 < FUN_PICK * FUN_PICK) {
        funVisibleRef.current[i] = false;
        funTakenRef.current[i] = race.raceTime;
        setFunVisible(funVisibleRef.current.slice());
        const type = funRollTable[(Math.random() * funRollTable.length) | 0];
        useRace.getState().grantItem(type);
        funBurst(f); audio.play?.("funActivate", { volume: 0.5 });
      }
    }

    const item = !!getKeys().useItem;
    if (item && !prevItem.current) {
      const type = useRace.getState().consumeItem();
      if (type) {
        const tune = playerTuneRef.current || allKarts().find((k) => k.isPlayer)?.tune;
        useRace.getState().applyFunEffect(type, tune?.funDuration ? 1 + tune.funDuration : 1);
        if (type === "recoveryBoost" && pk.state) applyRecovery(pk.state);
        if (type === "opponentDisrupt") {
          for (const k of allKarts()) {
            if (k.isPlayer || !k.state) continue;
            const d = (k.position[0] - px) ** 2 + (k.position[2] - pz) ** 2;
            if (d < 2500) { k.state.spin += (Math.random() < 0.5 ? -1 : 1) * 2; k.state.speed *= 0.6; }
          }
        }
        funBurst(pk.position); audio.play?.("funActivate");
      }
    }
    prevItem.current = item;

    const haz = hazardsRef.current;
    for (let h = 0; h < haz.length; h++) {
      const hz = haz[h];
      if (!hz || hz.active === false) continue;
      const rr = hz.radius + 1.4;
      for (const k of allKarts()) {
        if (!k.state) continue;
        const dx = k.position[0] - hz.position[0], dz = k.position[2] - hz.position[2];
        if (dx * dx + dz * dz < rr * rr) {
          const cd = hitCd.current.get(k.id) || 0;
          if (race.raceTime < cd) continue;
          if (k.isPlayer && race.activeEffects.some((e) => e.type === "shield" || e.type === "fudImmunity")) continue;
          hitCd.current.set(k.id, race.raceTime + 0.9);
          const pen = (fudTypes[hz.type] || fudTypes.stationary).penalty;
          const len = Math.hypot(dx, dz) || 1;
          applyFudHit(k.state, pen, k.tune || { stunMult: 1, knockMult: 1, recovery: 0.5 }, [dx / len, 0, dz / len]);
          fudBurst(k.position);
          if (k.isPlayer) { useRace.getState().registerFudHit(); audio.play?.("fudHit"); }
        }
      }
    }
  }

  useFrame((_, delta) => {
    const race = useRace.getState();
    const live = race.phase === PHASE.RACING;
    if (live) race.tick(delta);
    if (!live && race.phase !== PHASE.FINISHED) return;

    const pk = getKart(race.playerId || "player");
    updateHazards(race.raceTime, pk ? pk.position[0] : 0, pk ? pk.position[2] : 0);

    for (const k of allKarts()) {
      const pr = prog.current.get(k.id);
      if (!pr || pr.finished) { if (pr) useRace.getState().updateRacerProgress(k.id, { finished: true }); continue; }
      const p = projectToLine(k.position[0], k.position[2], pr.seg);
      if (live && k.state) containKart(k.state, p);
      if (p.station > N * 0.45 && p.station < N * 0.95) pr.passedHalf = true;
      // Anti-shortcut: the lap only counts when the kart crosses the line
      // FORWARD (station was already near the end of the loop). Driving
      // backward over the line must not decrement/recount laps.
      const crossedForward = pr.station > N - 3;
      if (crossedForward && p.station < 3 && pr.passedHalf) {
        pr.lap += 1; pr.passedHalf = false;
        if (k.isPlayer) { useRace.getState().completeLap(); audio.play?.("lapComplete"); }
        if (pr.lap >= useRace.getState().totalLaps) { pr.finished = true; useRace.getState().finishRacer(k.id); }
      }
      pr.seg = p.seg; pr.station = p.station;
      const kk = getKart(k.id); if (kk) kk.cpIndex = p.seg;
      useRace.getState().updateRacerProgress(k.id, { progress: pr.lap * N + p.station, cpIndex: p.seg, lap: pr.lap, finished: pr.finished });
    }
    useRace.getState().computePositions();
    for (const r of useRace.getState().racers) { const kk = getKart(r.id); if (kk) kk.place = r.place; }

    if (live) runCollisions(race);

    const player = useRace.getState().racers.find((r) => r.isPlayer);
    if (player?.finished && !finishScheduled.current) {
      finishScheduled.current = true;
      const playerTune = allKarts().find((k) => k.isPlayer)?.tune;
      useRace.getState().finishRace({ scoreMult: playerTune?.scoreMult ?? 1 });
      audio.play?.("finish");
      timers.current.push(setTimeout(persistAndShow, 3500));
    }
  });

  return (
    <group>
      {grid.length === roster.length &&
        roster.map((r, i) => (
          <KartController
            key={`${raceKey}-${r.id}`}
            racer={r}
            start={grid[i]}
            difficulty={difficulty}
            hazardsRef={hazardsRef}
            groundSampler={groundSampler}
          />
        ))}

      {roster.length > 0 && coinSpawns.map((c, i) => (
        <Tapcoin key={`${raceKey}-c${i}`} position={c} collected={!!coinTaken[i]} />
      ))}

      {roster.length > 0 && funSpawns.map((f, i) =>
        funVisible[i] ? <FunBox key={`${raceKey}-f${i}`} position={f} /> : null
      )}

      {roster.length > 0 && fudData.map((f, i) => (
        <group key={`${raceKey}-x${i}`} ref={(el) => (fudGroupRefs.current[i] = el)}>
          <Fud position={[0, 0, 0]} type={f.type} scale={0.65 + f.radius * 0.45} />
        </group>
      ))}
    </group>
  );
}

export default RaceManager;


// Build the 5-racer roster: player (from progress selection) + 4 AI personalities.
function buildRoster(selectedKart, selectedCharacter, upgrades) {
  const player = {
    id: "player",
    name: "YOU",
    isPlayer: true,
    kart: selectedKart,
    character: selectedCharacter,
    upgrades: upgrades[selectedKart] || {},
  };
  const ai = aiRoster.map((pid) => {
    const p = aiPersonalities[pid];
    return { id: pid, name: p.name, isPlayer: false, personality: pid, kart: p.kart, character: "satoshi", upgrades: {} };
  });
  return [player, ...ai];
}

// A 2-column staggered grid sitting just BEHIND the start/finish line (waypoint
// 0) so crossing the line starts lap 1 and a full loop completes it. Heading is
// the travel direction heading into waypoint 0.
function buildStartGrid(count) {
  const wp0 = racingLine[0];
  const prev = racingLine[N - 1];
  const heading = headingTo(prev[0], prev[2], wp0[0], wp0[2]);
  const nrm = racingNormals[0];
  const slots = [];
  for (let i = 0; i < count; i++) {
    const col = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const lateral = col * 4.5;
    const back = 4 + row * 6; // staggered behind the line along -travel
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    slots.push({
      x: wp0[0] + nrm[0] * lateral - fx * back,
      z: wp0[2] + nrm[1] * lateral - fz * back,
      heading,
    });
  }
  return slots;
}


// Signed heading so forward=(-sin h,-cos h) points from A toward B.
function headingTo(ax, az, bx, bz) {
  return Math.atan2(-(bx - ax), -(bz - az));
}

// Nearest point on the racing line, searching a window around prevSeg.
// Returns the station (lap-space scalar), the closest point and the local
// half-width so callers can keep karts on the track.
function projectToLine(x, z, prevSeg) {
  let best = { seg: prevSeg, t: 0, dist: Infinity, station: prevSeg, cx: x, cz: z, half: 16 };
  for (let o = -3; o <= 6; o++) {
    const i = ((prevSeg + o) % N + N) % N;
    const a = racingLine[i], b = racingLine[(i + 1) % N];
    const abx = b[0] - a[0], abz = b[2] - a[2];
    const len2 = abx * abx + abz * abz || 1;
    let t = ((x - a[0]) * abx + (z - a[2]) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + abx * t, cz = a[2] + abz * t;
    const d = (x - cx) ** 2 + (z - cz) ** 2;
    if (d < best.dist) {
      const half = (a[3] ?? 16) + ((b[3] ?? 16) - (a[3] ?? 16)) * t;
      best = { seg: i, t, dist: d, station: i + t, cx, cz, half };
    }
  }
  return best;
}

// Soft wall: if a kart strays past the local half-width, pull it back toward
// the line and scrub speed so it can't shortcut across scenery or fall off.
function containKart(st, p) {
  const margin = p.half - 1.5;
  if (margin <= 0) return;
  const dist = Math.sqrt(p.dist);
  if (dist <= margin) return;
  const over = dist - margin;
  const inx = (p.cx - st.px) / (dist || 1);
  const inz = (p.cz - st.pz) / (dist || 1);
  st.px += inx * over;
  st.pz += inz * over;
  st.speed *= 0.9;
}
