import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { CylinderGeometry, PlaneGeometry, DoubleSide } from "three";
import { palette } from "../theme";

// Low-poly instanced palms. Each palm is one trunk instance + a ring of frond
// instances; everything is drawn through two InstancedMeshes regardless of how
// many palms are placed. Geometry is procedural (tapered cylinder trunk, bent
// tapered planes for fronds) so there are no assets to load.

const FRONDS_PER_PALM = 7;
const TRUNK_HEIGHT = 3.2;

// Deterministic PRNG so palm variation is stable across reloads.
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

function makeTrunkGeometry() {
  const g = new CylinderGeometry(0.12, 0.26, TRUNK_HEIGHT, 7, 1);
  g.translate(0, TRUNK_HEIGHT / 2, 0); // base at y=0
  return g;
}

function makeFrondGeometry() {
  const g = new PlaneGeometry(2.4, 0.55, 10, 1);
  g.rotateX(-Math.PI / 2); // lie flat: length along X, width along Z, normal +Y
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = (x + 1.2) / 2.4; // 0 at base .. 1 at tip
    p.setZ(i, p.getZ(i) * (1.0 - 0.8 * t)); // taper width toward tip
    p.setY(i, p.getY(i) - Math.pow(t, 2.0) * 0.9); // droop the tip
  }
  p.needsUpdate = true;
  g.translate(1.2, 0, 0); // pivot at frond base
  g.computeVertexNormals();
  return g;
}

export const Palms = ({
  positions = [],
  trunkColor = "#8a6a44",
  frondColor = palette.foliage,
  minScale = 0.9,
  maxScale = 1.6,
  seed = 1337,
}) => {
  const trunkGeo = useMemo(() => makeTrunkGeometry(), []);
  const frondGeo = useMemo(() => makeFrondGeometry(), []);

  // Pre-compute per-palm and per-frond transforms deterministically.
  const palms = useMemo(() => {
    const rand = mulberry32(seed);
    return positions.map((pos) => {
      const scale = minScale + rand() * (maxScale - minScale);
      const rotY = rand() * Math.PI * 2;
      const fronds = [];
      for (let k = 0; k < FRONDS_PER_PALM; k++) {
        const angle = rotY + (k / FRONDS_PER_PALM) * Math.PI * 2;
        const tilt = 0.25 + rand() * 0.3; // lift fronds up from horizontal
        fronds.push({ angle, tilt });
      }
      return { pos, scale, rotY, fronds };
    });
  }, [positions, minScale, maxScale, seed]);

  if (positions.length === 0) return null;

  const trunkCount = palms.length;
  const frondCount = palms.length * FRONDS_PER_PALM;

  return (
    <group>
      <Instances limit={trunkCount} range={trunkCount} geometry={trunkGeo}>
        <meshStandardMaterial color={trunkColor} roughness={0.9} metalness={0} />
        {palms.map((palm, i) => (
          <Instance
            key={i}
            position={palm.pos}
            rotation={[0, palm.rotY, 0]}
            scale={palm.scale}
          />
        ))}
      </Instances>

      <Instances limit={frondCount} range={frondCount} geometry={frondGeo}>
        <meshStandardMaterial
          color={frondColor}
          roughness={0.8}
          metalness={0}
          side={DoubleSide}
        />
        {palms.flatMap((palm, i) =>
          palm.fronds.map((f, k) => (
            <Instance
              key={`${i}-${k}`}
              position={[
                palm.pos[0],
                palm.pos[1] + TRUNK_HEIGHT * palm.scale,
                palm.pos[2],
              ]}
              rotation={[0, f.angle, f.tilt]}
              scale={palm.scale}
            />
          ))
        )}
      </Instances>
    </group>
  );
};

export default Palms;
