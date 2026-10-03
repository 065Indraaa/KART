// DriverBust - the visible racer sitting in the kart. Cartoon chimp driver
// matching the $TAP mascot (public/assets/tap-coin.png): dark fur, tan muzzle,
// round ears, big friendly eyes, a body with arms reaching the wheel, and a
// cap carrying the $TAP emblem. The player wears the classic black cap; AI
// drivers get tinted outfits so each opponent is readable at race speed.
import { useTexture } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

const FUR = "#3a3230";
const FUR_DARK = "#2c2624";
const SKIN = "#c99a6b";
const CAP_DEFAULT = "#1c1c1e";

// One entry per AI personality (matches RaceManager roster order).
const AI_OUTFITS = {
  velocita: { cap: "#c8102e", shirt: "#8f0c20" },
  oracle: { cap: "#f2c500", shirt: "#a88700" },
  rugpull: { cap: "#7b2fbe", shirt: "#5c2191" },
  whale: { cap: "#0e7490", shirt: "#0a5a70" },
};

// Simple rounded-eye helper: white ball + dark pupil, slightly oversized so
// the driver reads as friendly from the chase camera.
function Eye({ offset }) {
  return (
    <group position={offset}>
      <mesh>
        <sphereGeometry args={[0.062, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshStandardMaterial color="#171310" roughness={0.2} />
      </mesh>
    </group>
  );
}

// Head bobs subtly with speed so the driver feels alive at ~10 tris of cost.
export function DriverBust({ tint, isPlayer = true, lean = 0 }) {
  const group = useRef(null);
  const head = useRef(null);
  const tapTex = useTexture("/assets/tap-coin.png");

  const outfit = useMemo(
    () => (isPlayer
      ? { cap: CAP_DEFAULT, shirt: "#2f6db5" }
      : AI_OUTFITS[tint] || { cap: "#2a2a2e", shirt: "#3c3c44" }),
    [isPlayer, tint]
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.rotation.z = Math.sin(t * 3.1) * 0.02 + lean * 0.25;
    group.current.rotation.x = Math.sin(t * 2.3) * 0.012;
    if (head.current) head.current.rotation.y = Math.sin(t * 1.7) * 0.06;
  });

  return (
    <group ref={group} position={[0, 0.28, 0.08]}>
      {/* torso seated in the bucket seat; arms reach forward to the wheel */}
      <mesh castShadow position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.155, 0.18, 4, 10]} />
        <meshStandardMaterial color={outfit.shirt} roughness={0.8} />
      </mesh>
      {/* shoulders */}
      <mesh position={[0, 0.27, 0]}>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial color={outfit.shirt} roughness={0.8} />
      </mesh>
      {/* arms toward the steering wheel (which sits ahead+up) */}
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * 0.17, 0.24, 0.14]} rotation={[1.15, 0, side * -0.25]}>
          <capsuleGeometry args={[0.05, 0.22, 3, 8]} />
          <meshStandardMaterial color={outfit.shirt} roughness={0.8} />
        </mesh>
      ))}
      {/* gloved hands on the wheel */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.13, 0.4, 0.3]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.9} />
        </mesh>
      ))}

      {/* head */}
      <group ref={head} position={[0, 0.52, 0.02]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 20, 16]} />
          <meshStandardMaterial color={FUR} roughness={0.85} />
        </mesh>
        {/* muzzle + smile */}
        <mesh castShadow position={[0, -0.09, 0.24]}>
          <sphereGeometry args={[0.17, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.12, 0.38]} rotation={[0.35, 0, 0]}>
          <torusGeometry args={[0.06, 0.016, 8, 12, Math.PI]} />
          <meshStandardMaterial color="#171310" roughness={0.6} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.31, 0.02, -0.02]} rotation={[0, 0, side * -0.25]}>
            <sphereGeometry args={[0.115, 12, 10]} />
            <meshStandardMaterial color={FUR_DARK} roughness={0.9} />
          </mesh>
        ))}
        {/* eyes */}
        <Eye offset={[-0.1, 0.05, 0.26]} />
        <Eye offset={[0.1, 0.05, 0.26]} />
        {/* brow ridge for a chunkier chimp silhouette */}
        <mesh position={[0, 0.13, 0.24]} scale={[1, 0.5, 0.8]}>
          <sphereGeometry args={[0.15, 12, 10]} />
          <meshStandardMaterial color={FUR_DARK} roughness={0.9} />
        </mesh>

        {/* cap crown + brim; the $TAP emblem texture sits on the front */}
        <mesh castShadow position={[0, 0.18, 0]} scale={[1, 0.62, 1]}>
          <sphereGeometry args={[0.31, 20, 14]} />
          <meshStandardMaterial color={outfit.cap} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.14, 0.26]} rotation={[-0.25, 0, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.045, 18, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={outfit.cap} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.21, 0.26]}>
          <circleGeometry args={[0.11, 20]} />
          <meshStandardMaterial map={tapTex} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

export default DriverBust;
