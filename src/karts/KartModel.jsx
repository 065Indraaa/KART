// Render-only kart visual, shared by the player and every AI. Reads the mutable
// physics state (a ref) each frame — never writes global stores — so it is safe
// to mount many times. Body colour is per-instance (cloned material). Lightweight
// drift sparks + boost flame are toggled via refs (no per-kart particle systems).
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color } from "three";
import { palette } from "../theme";
import { DRIFT_TIERS } from "./kartTuning";
import { DriverBust } from "./DriverBust";

const DRIFT_COLORS = ["#ffffff", "#00e5ff", "#ffcf3a", "#b100ff"]; // tier 0..3
// The track's racing line spans hundreds of world units, so at 1:1 the kart
// reads tiny. Scale the whole visual rig up; physics colliders unaffected.
const KART_VISUAL_SCALE = 1.45;

export function KartModel({ stateRef, tune, bodyColor, bodyScale = KART_VISUAL_SCALE, driverTint, isPlayer = true }) {
  // Driver leans with drift so the character sells the steering.
  const { nodes, materials } = useGLTF("/models/kart.glb");

  const leanRef = useRef(null);
  const frontWheels = useRef(null);
  const wheelRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const steerWheel = useRef(null);
  const flameL = useRef(null);
  const flameR = useRef(null);
  const sparkL = useRef(null);
  const sparkR = useRef(null);

  const bodyMat = useMemo(() => {
    const m = materials.m_Body.clone();
    m.color = new Color(bodyColor || tune?.bodyColor || "#3aa0ff");
    m.emissive = new Color(bodyColor || "#000000");
    m.emissiveIntensity = 0;
    return m;
  }, [materials.m_Body, bodyColor, tune]);

  useFrame((_, delta) => {
    const st = stateRef.current;
    if (!st) return;
    const dt = Math.min(delta, 0.1);

    // wheel roll from speed
    const roll = st.speed * 0.02;
    for (const w of wheelRefs) if (w.current) w.current.rotation.x += roll;

    // front-wheel + steering-wheel yaw from steer
    const steer = st.steer || 0;
    if (frontWheels.current) frontWheels.current.rotation.y = steer * 0.5;
    if (steerWheel.current) steerWheel.current.rotation.y = steer * 1.4;

    // drift lean (roll) toward drift direction, settle otherwise
    if (leanRef.current) {
      const targetRoll = st.driftDir * 0.28;
      leanRef.current.rotation.z += (targetRoll - leanRef.current.rotation.z) * Math.min(1, 8 * dt);
      // small spin tilt when FUD-stunned
      const targetYaw = st.driftDir * 0.18;
      leanRef.current.rotation.y += (targetYaw - leanRef.current.rotation.y) * Math.min(1, 8 * dt);
    }

    // boost flame
    const boosting = st.turbo > 0;
    const fScale = boosting ? 1 : 0;
    for (const f of [flameL, flameR]) {
      if (!f.current) continue;
      f.current.scale.setScalar(f.current.scale.x + (fScale - f.current.scale.x) * Math.min(1, 12 * dt));
      f.current.visible = f.current.scale.x > 0.05;
    }
    bodyMat.emissiveIntensity += ((boosting ? 0.6 : 0) - bodyMat.emissiveIntensity) * Math.min(1, 10 * dt);

    // drift sparks
    const drifting = st.driftDir !== 0 && st.driftTime > DRIFT_TIERS[1] * 0.4;
    const col = DRIFT_COLORS[Math.min(3, st.driftTier)];
    for (const s of [sparkL, sparkR]) {
      if (!s.current) continue;
      const target = drifting ? 1 : 0;
      s.current.scale.setScalar(s.current.scale.x + (target - s.current.scale.x) * Math.min(1, 14 * dt));
      s.current.visible = s.current.scale.x > 0.05;
      s.current.material.color.set(col);
    }
  });

  return (
    <group ref={leanRef} scale={bodyScale} dispose={null}>
      <group rotation-y={Math.PI} position-y={-0.5}>
        <mesh castShadow receiveShadow geometry={nodes.body.geometry} material={bodyMat}>
          <DriverBust tint={driverTint} isPlayer={isPlayer} lean={stateRef.current?.driftDir ?? 0} />
          <mesh
            ref={steerWheel}
            geometry={nodes.d_wheel.geometry}
            material={materials.m_Body}
            position={[0, 0.355, 0.542]}
            rotation={[-1.134, 0, 0]}
          />
          <mesh
            geometry={nodes.booster.geometry}
            material={materials.m_Body}
            position={[0, 0.25, -0.55]}
            rotation={[0.279, 0, 0]}
          />
          {/* boost flames */}
          <mesh ref={flameL} position={[0.4, 0.1, -1.15]} visible={false}>
            <coneGeometry args={[0.18, 0.9, 10]} />
            <meshBasicMaterial color={palette.fun} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh ref={flameR} position={[-0.4, 0.1, -1.15]} visible={false}>
            <coneGeometry args={[0.18, 0.9, 10]} />
            <meshBasicMaterial color={palette.fun} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* drift sparks */}
          <mesh ref={sparkL} position={[0.77, -0.2, -0.7]} visible={false}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh ref={sparkR} position={[-0.77, -0.2, -0.7]} visible={false}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </mesh>

        <mesh ref={wheelRefs[0]} castShadow geometry={nodes.wheel_2.geometry} material={materials.m_Tire} position={[-0.77, -0.137, -0.7]} />
        <mesh ref={wheelRefs[1]} castShadow geometry={nodes.wheel_3.geometry} material={materials.m_Tire} position={[0.77, -0.137, -0.7]} />
        <group ref={frontWheels}>
          <mesh ref={wheelRefs[2]} castShadow geometry={nodes.wheel_1.geometry} material={materials.m_Tire} position={[0.7, -0.2, 0.7]} />
          <mesh ref={wheelRefs[3]} castShadow geometry={nodes.wheel_0.geometry} material={materials.m_Tire} position={[-0.7, -0.2, 0.7]} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/models/kart.glb");
export default KartModel;
