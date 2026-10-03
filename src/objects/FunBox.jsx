import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { AdditiveBlending } from "three";
import { palette } from "../theme";

/**
 * FunBox — a glowing power-up cube. Slow tumble, gentle bob, pulsing emissive
 * intensity and a soft additive halo. `color` overrides the default blue.
 */
export function FunBox({ position, color = palette.fun }) {
  const mesh = useRef(null);
  const mat = useRef(null);
  const haloMat = useRef(null);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const m = mesh.current;
    if (m) {
      m.rotation.y += delta * 0.6;
      m.rotation.x += delta * 0.25;
      m.position.y = Math.sin(t * 1.6) * 0.2; // bob within the placed group
    }
    if (mat.current) mat.current.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.5;
    if (haloMat.current) haloMat.current.opacity = 0.4 + Math.sin(t * 3) * 0.12;
  });

  return (
    <group position={position}>
      <mesh ref={mesh} castShadow>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>

      <Billboard>
        <mesh>
          <circleGeometry args={[1.6, 24]} />
          <meshBasicMaterial
            ref={haloMat}
            color={palette.funGlow}
            transparent
            opacity={0.4}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export default FunBox;
