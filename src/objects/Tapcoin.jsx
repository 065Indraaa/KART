import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import { AdditiveBlending } from "three";
import { palette, tapcoin } from "../theme";

// spinRpm -> radians per second
const SPIN = (tapcoin.spinRpm / 60) * Math.PI * 2;
const PICKUP_DURATION = 0.28; // seconds for the collect pop-and-fade

/**
 * Tapcoin — a spinning, bobbing gold coin collectible whose faces carry the
 * official $TAP logo (/assets/tap-coin.png) on a gold rim. When `collected`
 * flips true it plays a quick scale-up + fade, then unmounts.
 */
export function Tapcoin({ position, collected }) {
  const group = useRef(null);
  const discMat = useRef(null);
  const haloMat = useRef(null);
  const pickup = useRef(0); // elapsed collect-animation time
  const [hidden, setHidden] = useState(false);
  const logoTex = useTexture("/assets/tap-coin.png");

  const baseY = position ? position[1] : 0;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();

    // idle spin around Y (keeps spinning through the pickup)
    g.rotation.y += SPIN * delta;

    if (collected) {
      pickup.current += delta;
      const p = Math.min(pickup.current / PICKUP_DURATION, 1);
      g.scale.setScalar(1 + p * 0.8);
      const alpha = 1 - p;
      if (discMat.current) {
        discMat.current.opacity = alpha;
        discMat.current.emissiveIntensity = 1.4 + p * 2.5;
      }
      if (haloMat.current) haloMat.current.opacity = 0.6 * alpha;
      if (p >= 1) setHidden(true);
    } else {
      // vertical bob
      g.position.y = baseY + Math.sin(t * 2) * tapcoin.bob;
    }
  });

  if (hidden) return null;

  return (
    <group ref={group} position={position}>
      {/* gold coin: emblem disc on both faces of a rimmed cylinder */}
      <group rotation={[-Math.PI * 0.12, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[tapcoin.radius, tapcoin.radius, 0.18, 24]} />
          <meshStandardMaterial
            ref={discMat}
            color={palette.tapcoin}
            emissive={palette.tapcoin}
            emissiveIntensity={1.4}
            metalness={0.6}
            roughness={0.25}
            transparent
          />
        </mesh>
        {/* $TAP logo faces (front + back) */}
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[tapcoin.radius * 0.82, 24]} />
          <meshStandardMaterial map={logoTex} transparent emissiveMap={logoTex} emissive="#ffffff" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -0.095, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[tapcoin.radius * 0.82, 24]} />
          <meshStandardMaterial map={logoTex} transparent emissiveMap={logoTex} emissive="#ffffff" emissiveIntensity={0.35} />
        </mesh>
      </group>

      {/* emissive glow halo (circle billboard, additive) */}
      <Billboard>
        <mesh>
          <circleGeometry args={[tapcoin.radius * 1.9, 24]} />
          <meshBasicMaterial
            ref={haloMat}
            color={palette.tapcoinGlow}
            transparent
            opacity={0.6}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export default Tapcoin;
