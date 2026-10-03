// Instantiable kart. Drives the player (keyboard/touch/gamepad + chase camera)
// or an AI (AIController) through the SAME pure physics, so all five racers feel
// consistent. Writes only its own slot in kartRegistry; the RaceManager reads
// the registry for ranking and collisions.
import { useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { buildKartTuning } from "./kartTuning";
import { createKartState, stepKart } from "./kartPhysics";
import { KartModel } from "./KartModel";
import { registerKart, writeKart, getKart, opponentsOf } from "./kartRegistry";
import { createAIController } from "../ai/AIController";
import { useGroundSampler } from "./useGroundSampler";
import { racingLine, racingNormals } from "../trackData";
import { useRace, PHASE } from "../raceStore";
import { useGameStore } from "../store";
import { aiPersonalities } from "../theme";

const RIDE_HEIGHT = 0.9;
const scratch = new Vector3();

// Closest waypoint (windowed like projectToLine in RaceManager).
function nearestWaypoint(x, z, hint) {
  const line = racingLine;
  const n = line.length;
  let best = hint, bestD = Infinity;
  for (let o = -4; o <= 8; o++) {
    const i = ((hint + o) % n + n) % n;
    const d = (x - line[i][0]) ** 2 + (z - line[i][2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return line[best];
}

// Heading pointing from this waypoint toward the next (track direction).
function headingOfWaypoint(wp) {
  const line = racingLine;
  const i = line.indexOf(wp);
  const next = line[(i + 1) % line.length];
  return Math.atan2(-(next[0] - wp[0]), -(next[2] - wp[2]));
}

export function KartController({ racer, start, difficulty = 0.65, hazardsRef, groundSampler }) {
  const { id, isPlayer, personality, kart, character, upgrades } = racer;

  const rigRef = useRef(null);
  const camGroupRef = useRef(null);
  const camLookRef = useRef(null);

  const tune = useMemo(
    () => buildKartTuning({ kartId: kart, characterId: character, upgrades }),
    [kart, character, upgrades]
  );
  const stateRef = useRef(createKartState(start.x, start.z, start.heading));
  const ai = useMemo(() => {
    if (isPlayer) return null;
    return createAIController({
      personality: aiPersonalities[personality],
      difficulty,
      racingLine,
      racingNormals,
    });
  }, [isPlayer, personality, difficulty]);

  const [, getKeys] = useKeyboardControls();
  const { camera } = useThree();
  const localSampler = useGroundSampler();
  const sampleGroundY = (groundSampler || localSampler).sampleGroundY;

  const setSpeed = useGameStore((s) => s.setSpeed);
  const setIsBoosting = useGameStore((s) => s.setIsBoosting);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);

  useEffect(() => {
    const st = stateRef.current;
    registerKart(id, { isPlayer, state: st, tune, position: [st.px, st.py, st.pz], heading: st.heading });
    // Snap the rig to the grid slot immediately.
    if (rigRef.current) {
      const gy = sampleGroundY(st.px, st.pz, 0);
      rigRef.current.position.set(st.px, gy + RIDE_HEIGHT, st.pz);
      rigRef.current.rotation.y = st.heading;
    }
  }, [id, isPlayer, sampleGroundY]);

  function readPlayerInput() {
    const k = getKeys();
    const gs = useGameStore.getState();
    const joy = gs.joystick || { x: 0, y: 0 };
    const gp = gs.gamepad;
    let throttle = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    let steer = (k.left ? 1 : 0) - (k.right ? 1 : 0) - (joy.x || 0);
    let jump = !!k.jump || !!gs.jumpButtonPressed;
    let item = !!k.useItem;
    let reset = !!k.reset;
    if (gp) {
      if (gp.buttons[0]?.pressed || gp.buttons[7]?.pressed) throttle = 1;
      if (gp.buttons[1]?.pressed) throttle = -1;
      steer -= gp.axes[0] || 0;
      if (gp.buttons[5]?.pressed) jump = true;
      if (gp.buttons[2]?.pressed) item = true;
    }
    // touch: auto-throttle forward unless braking
    if (joy.distance > 0 && throttle === 0) throttle = 1;
    return { throttle, steer: Math.max(-1, Math.min(1, steer)), jump, item, reset };
  }

  useFrame((state, delta) => {
    const st = stateRef.current;
    const rig = rigRef.current;
    if (!rig) return;
    const race = useRace.getState();
    const phase = race.phase;
    const dt = Math.min(delta, 0.05);

    const racing = phase === PHASE.RACING;
    let input;
    if (!racing) {
      input = { throttle: 0, steer: 0, jump: false, item: false, reset: false };
    } else if (isPlayer) {
      input = readPlayerInput();
    } else {
      const self = {
        position: [st.px, st.py, st.pz],
        heading: st.heading,
        speed: st.speed,
        maxSpeed: tune.maxSpeed,
        currentWaypoint: getKart(id)?.cpIndex ?? 0,
        hasItem: false,
        stunned: st.stunTime > 0,
      };
      input = ai.computeInput({
        self,
        opponents: opponentsOf(id),
        hazards: hazardsRef?.current || [],
        dt,
        raceProgress: Math.min(1, race.raceTime / 90),
        rank: getKart(id)?.place ?? 3,
      });
      input.reset = false;
    }

    // FUN modifiers (player only) from active effects.
    let mod;
    if (isPlayer && racing) {
      mod = {};
      for (const e of race.activeEffects) {
        if (e.type === "speedBoost") { st.turbo = Math.max(st.turbo, dt + 0.02); mod.speedMult = 1.25; }
        if (e.type === "accelBoost") mod.accelMult = e.magnitude || 1.5;
        if (e.type === "handlingBoost") mod.handlingMult = e.magnitude || 1.4;
      }
    }

    if (racing) stepKart(st, input, tune, dt, mod);

    // R (advertised in the menu) respawns the player at the nearest waypoint
    // facing along the track — the escape hatch when stuck against a wall.
    if (isPlayer && input.reset) {
      const wp = nearestWaypoint(st.px, st.pz, getKart(id)?.cpIndex ?? 0);
      st.px = wp[0];
      st.pz = wp[2];
      st.speed = 0;
      st.heading = headingOfWaypoint(wp);
      st.driftDir = 0; st.driftTime = 0; st.driftTier = 0;
      st.spin = 0; st.stunTime = 0; st.turbo = 0;
    }

    const gy = sampleGroundY(st.px, st.pz, rig.position.y - RIDE_HEIGHT);
    rig.position.set(st.px, gy + RIDE_HEIGHT + st.yHop, st.pz);
    rig.rotation.y = st.heading;

    const k = getKart(id);
    if (k) { k.position[0] = st.px; k.position[1] = gy; k.position[2] = st.pz; k.heading = st.heading; k.speed = st.speed; }
    else writeKart(id, { position: [st.px, gy, st.pz], heading: st.heading, speed: st.speed });

    if (isPlayer) {
      setSpeed(st.speed);
      setIsBoosting(st.turbo > 0);
      scratch.set(st.px, gy, st.pz);
      setPlayerPosition(scratch.clone());
      // chase camera
      if (camGroupRef.current && camLookRef.current) {
        const camTarget = camGroupRef.current.getWorldPosition(new Vector3());
        const lookTarget = camLookRef.current.getWorldPosition(new Vector3());
        const lerp = racing ? 6 : 3;
        camera.position.lerp(camTarget, Math.min(1, lerp * dt));
        camera.lookAt(lookTarget);
      }
    }
  });

  return (
    <group ref={rigRef}>
      {isPlayer && (
        <>
          <group ref={camGroupRef} position={[0, 3.2, 6.5]} />
          <group ref={camLookRef} position={[0, 0.5, -4]} />
        </>
      )}
      <KartModel stateRef={stateRef} tune={tune} bodyColor={tune.bodyColor} driverTint={personality} isPlayer={isPlayer} />
    </group>
  );
}

export default KartController;
