import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending } from "three";
import { palette, fudTypes } from "../theme";

/**
 * Fud — the enemy. Near-black faceted body, two pulsing red eyes and a red rim
 * glow. Reads fudTypes[type] for its `motion`; animation is purely props+time
 * (no gameplay state). The race manager positions it — this only adds local
 * flourish: eye/rim pulse, menacing wobble, and spin for 'rotating'/'spin'.
 */
export function Fud({ position, type = "stationary", rotation, scale = 1 }) {
  const config = fudTypes[type] || fudTypes.stationary;
  const motion = config.motion;
  const spinRate =
    motion === "spin" ? ((config.rpm || 30) / 60) * Math.PI * 2 : 0;
  const s = scale;

  const body = useRef(null);
  const leftEye = useRef(null);
  const rightEye = useRef(null);
  const rimMat = useRef(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const b = body.current;
    if (b) {
      if (spinRate) b.rotation.y += spinRate * delta;
      // menacing idle wobble
      b.rotation.z = Math.sin(t * 1.4) * 0.08;
      b.position.y = Math.sin(t * 2.1) * 0.08;
    }
    const pulse = 1.6 + Math.sin(t * 4) * 0.8;
    if (leftEye.current) leftEye.current.emissiveIntensity = pulse;
    if (rightEye.current) rightEye.current.emissiveIntensity = pulse;
    if (rimMat.current) rimMat.current.opacity = 0.35 + Math.sin(t * 4) * 0.1;
  });

  return (
    <group position={position} rotation={rotation} scale={s}>
      <group ref={body}>
        {/* dark faceted body — strong, readable silhouette */}
        <mesh castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={palette.fudBody}
            emissive={palette.fudGlow}
            emissiveIntensity={0.25}
            metalness={0.4}
            roughness={0.6}
            flatShading
          />
        </mesh>

        {/* two emissive red eyes */}
        <mesh position={[-0.32, 0.15, 0.86]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial
            ref={leftEye}
            color={palette.fudEye}
            emissive={palette.fudEye}
            emissiveIntensity={1.6}
          />
        </mesh>
        <mesh position={[0.32, 0.15, 0.86]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial
            ref={rightEye}
            color={palette.fudEye}
            emissive={palette.fudEye}
            emissiveIntensity={1.6}
          />
        </mesh>
      </group>

      {/* red rim glow — scale-independent so it stays a soft aura at any size */}
      <Billboard>
        <mesh scale={1 / s}>
          <circleGeometry args={[1.7, 24]} />
          <meshBasicMaterial
            ref={rimMat}
            color={palette.fudGlow}
            transparent
            opacity={0.35}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export default Fud;
