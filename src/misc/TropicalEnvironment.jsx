import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Fog, IcosahedronGeometry } from "three";
import { palette } from "../theme";
import { Ocean } from "./Ocean";
import { Palms } from "./Palms";
import { Instances, Instance } from "@react-three/drei";

// Self-contained tropical coastal environment: animated ocean, a sandy island
// the track sits on, a rocky shoreline rim, distant cliffs, palm clusters and
// light horizon fog. Everything is positioned around `center` with sensible
// defaults so it frames the existing circuit (which lives near world origin).
//
// Nothing here edits the scene graph owned elsewhere — drop <TropicalEnvironment />
// anywhere inside the Canvas and it wires its own fog via the scene reference.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TropicalEnvironment = ({
  center = [0, 0, 0],
  seaLevel = -5,
  groundLevel = -2,
  oceanSize = 4000,
  islandRadius = 120,
  // palm placement
  palmClusters = 8,
  palmsPerCluster = 4,
  palmRingMin = 52,
  palmRingMax = 104,
  // shoreline + distant relief
  rimRocks = 30,
  cliffCount = 9,
  cliffRadius = 340,
  // atmosphere
  fogColor = palette.skyHorizon,
  fogNear = 70,
  fogFar = 780,
  seed = 20260402,
}) => {
  const scene = useThree((s) => s.scene);
  const [cx, , cz] = center;

  // Light horizon fog so distant palms/cliffs melt into the sky. Restored on
  // unmount so the component leaves the scene exactly as it found it.
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new Fog(fogColor, fogNear, fogFar);
    return () => {
      scene.fog = prev;
    };
  }, [scene, fogColor, fogNear, fogFar]);

  const rockGeo = useMemo(() => new IcosahedronGeometry(1, 0), []);

  // Palm positions: a few clusters scattered on the sand ring around the track.
  const palmPositions = useMemo(() => {
    const rand = mulberry32(seed);
    const out = [];
    for (let c = 0; c < palmClusters; c++) {
      const clusterAngle = (c / palmClusters) * Math.PI * 2 + rand() * 0.4;
      const clusterR = palmRingMin + rand() * (palmRingMax - palmRingMin);
      const bx = cx + Math.cos(clusterAngle) * clusterR;
      const bz = cz + Math.sin(clusterAngle) * clusterR;
      for (let p = 0; p < palmsPerCluster; p++) {
        const jitter = 7;
        out.push([
          bx + (rand() - 0.5) * jitter,
          groundLevel,
          bz + (rand() - 0.5) * jitter,
        ]);
      }
    }
    return out;
  }, [
    seed,
    palmClusters,
    palmsPerCluster,
    palmRingMin,
    palmRingMax,
    cx,
    cz,
    groundLevel,
  ]);

  // Rocky rim hiding the drop from the sand island down to the water line.
  const rimTransforms = useMemo(() => {
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const out = [];
    for (let i = 0; i < rimRocks; i++) {
      const a = (i / rimRocks) * Math.PI * 2 + (rand() - 0.5) * 0.15;
      const r = islandRadius + (rand() - 0.5) * 6;
      const h = 3 + rand() * 3.5; // tall enough to span ground->sea
      out.push({
        position: [
          cx + Math.cos(a) * r,
          (groundLevel + seaLevel) / 2 + (rand() - 0.5),
          cz + Math.sin(a) * r,
        ],
        scale: [2.5 + rand() * 2, h, 2.5 + rand() * 2],
        rotation: [rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4],
      });
    }
    return out;
  }, [seed, rimRocks, islandRadius, cx, cz, groundLevel, seaLevel]);

  // Distant cliff stacks that break up the horizon beyond the ocean.
  const cliffTransforms = useMemo(() => {
    const rand = mulberry32(seed ^ 0x85ebca6b);
    const out = [];
    for (let i = 0; i < cliffCount; i++) {
      const a = (i / cliffCount) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const r = cliffRadius + (rand() - 0.5) * 120;
      const h = 26 + rand() * 46;
      out.push({
        position: [
          cx + Math.cos(a) * r,
          seaLevel + h * 0.35,
          cz + Math.sin(a) * r,
        ],
        scale: [18 + rand() * 16, h, 18 + rand() * 16],
        rotation: [0, rand() * Math.PI * 2, 0],
      });
    }
    return out;
  }, [seed, cliffCount, cliffRadius, cx, cz, seaLevel]);

  return (
    <group>
      {/* Animated water */}
      <Ocean position={[cx, seaLevel, cz]} size={oceanSize} />

      {/* Sandy island the circuit rests on */}
      <mesh
        position={[cx, groundLevel - 0.1, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[islandRadius, 64]} />
        <meshStandardMaterial color={palette.sand} roughness={1} metalness={0} />
      </mesh>

      {/* Shoreline rocks */}
      <Instances limit={rimTransforms.length} range={rimTransforms.length} geometry={rockGeo}>
        <meshStandardMaterial color={"#b9a07a"} roughness={1} metalness={0} />
        {rimTransforms.map((t, i) => (
          <Instance key={i} position={t.position} scale={t.scale} rotation={t.rotation} />
        ))}
      </Instances>

      {/* Distant cliffs */}
      <Instances limit={cliffTransforms.length} range={cliffTransforms.length} geometry={rockGeo}>
        <meshStandardMaterial color={"#7d6f57"} roughness={1} metalness={0} />
        {cliffTransforms.map((t, i) => (
          <Instance key={i} position={t.position} scale={t.scale} rotation={t.rotation} />
        ))}
      </Instances>

      {/* Palm clusters */}
      <Palms positions={palmPositions} seed={seed} />
    </group>
  );
};

export default TropicalEnvironment;
