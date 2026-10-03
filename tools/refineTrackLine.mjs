// tools/refineTrackLine.mjs
// Refines src/trackData.js so the race matches the actual drivable road:
//   - Y of every waypoint is the real surface height (down-raycast over the
//     ground meshes, exactly like useGroundSampler at runtime).
//   - Waypoints that fall off the drivable area (old data had 5 sitting over
//     the sky dome) are snapped back onto the road along the loop.
//   - Each waypoint is recentered onto the widest drivable span across the
//     track (probing left/right along the local normal, walls = obstruction),
//     and halfWidth becomes wall-aware so containKart no longer lets karts
//     drive through barriers or off the island.
//   - Coins / FUN / FUD / checkpoints are regenerated from the refined line,
//     so pickups sit ON the road at the right height instead of floating.
// Run: node tools/refineTrackLine.mjs
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { racingLine as oldLine, racingNormals as oldNormals } from "../src/trackData.js";

const GLB = "./public/models/mario-circuit-test-transformed.glb";
const GROUP_POS = new THREE.Vector3(155, -28, 15);
const GROUP_SCALE = 0.08;
// Sky dome + tiny prop are NOT drivable (see Mario-circuit-test.jsx names).
const NON_DRIVABLE = new Set(["Object_18", "Object_22"]);
// Surfaces this far above the flat plane count as walls/rails, not road.
const WALL_Y = 0.2;
const N = oldLine.length;

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
const doc = await io.read(GLB);
const root = doc.getRoot();

const meshes = [];
for (const node of root.listNodes()) {
  if (NON_DRIVABLE.has(node.getName())) continue;
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos.getArray()), 3));
    const idx = prim.getIndices();
    if (idx) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx.getArray()), 1));
    geo.computeBoundsTree();
    const m = new THREE.Mesh(geo);
    m.position.copy(GROUP_POS);
    m.scale.setScalar(GROUP_SCALE);
    m.updateMatrixWorld(true);
    meshes.push(m);
  }
}

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const DOWN = new THREE.Vector3(0, -1, 0);
const ORIGIN = new THREE.Vector3();

// Highest surface under (x,z): null when over the void.
function surfaceY(x, z) {
  ORIGIN.set(x, 80, z);
  ray.set(ORIGIN, DOWN);
  ray.far = 200;
  const hits = ray.intersectObjects(meshes, false);
  return hits.length ? hits[0].point.y : null;
}

// Drivable road: a low surface. Elevated hits (walls, rails, props) block.
function drivable(x, z) {
  const y = surfaceY(x, z);
  return y != null && y <= WALL_Y;
}

// Longest contiguous drivable span across the track at (x,z) along normal n.
// Returns {centerOffset, half} in normal units, or null if nothing drivable.
function drivableSpan(x, z, nx, nz, maxHalf) {
  const step = 1;
  let best = null;
  let runStart = null;
  for (let o = -maxHalf; o <= maxHalf; o += step) {
    if (drivable(x + nx * o, z + nz * o)) {
      if (runStart == null) runStart = o;
    } else if (runStart != null) {
      const run = { from: runStart, to: o - step };
      if (!best || run.to - run.from > best.to - best.from) best = run;
      runStart = null;
    }
  }
  if (runStart != null) {
    const run = { from: runStart, to: maxHalf };
    if (!best || run.to - run.from > best.to - best.from) best = run;
  }
  if (!best) return null;
  return { centerOffset: (best.from + best.to) / 2, half: (best.to - best.from) / 2 };
}

// --- 1) snap off-road waypoints back onto the loop -------------------------
const line = oldLine.map((p) => [p[0], p[1], p[2], p[3]]);
let snapped = 0;
for (let i = 0; i < N; i++) {
  if (drivable(line[i][0], line[i][2])) continue;
  // Search along the loop toward both neighbors for the nearest drivable spot.
  let bestJ = null, bestD = Infinity;
  for (const dir of [1, -1]) {
    for (let k = 1; k <= 8; k++) {
      const j = (i + dir * k + N) % N;
      if (!drivable(line[j][0], line[j][2])) continue;
      if (k < bestD) { bestD = k; bestJ = j; }
      break;
    }
  }
  if (bestJ == null) throw new Error(`waypoint ${i} off-road with no drivable neighbor`);
  const a = line[bestJ], b = line[i];
  // Slide from the off-road point toward the drivable neighbor.
  for (let t = 0.1; t <= 1.0; t += 0.1) {
    const x = b[0] + (a[0] - b[0]) * t;
    const z = b[2] + (a[2] - b[2]) * t;
    if (drivable(x, z)) {
      line[i][0] = x; line[i][2] = z;
      snapped++;
      break;
    }
  }
}
console.log("snapped waypoints:", snapped);

// --- 2) recenter onto the corridor, wall-aware halfWidth -------------------
const PROBE = 34; // max half-width probe (old data capped at 28)
for (let pass = 0; pass < 3; pass++) {
  let moved = 0;
  for (let i = 0; i < N; i++) {
    const [nx, nz] = oldNormals[i];
    const span = drivableSpan(line[i][0], line[i][2], nx, nz, PROBE);
    if (!span) continue;
    if (Math.abs(span.centerOffset) > 0.5) moved++;
    line[i][0] += nx * span.centerOffset;
    line[i][2] += nz * span.centerOffset;
    // Keep the kart center ~1.6 from walls (kart body is ~2.8 wide at scale 1.45).
    line[i][3] = Math.min(span.half - 1.6, 28);
  }
  console.log(`pass ${pass}: recentered ${moved} waypoints`);
}

// --- 3) true surface heights ----------------------------------------------
for (const p of line) {
  const y = surfaceY(p[0], p[2]);
  if (y == null) throw new Error(`waypoint still off-road: ${p[0]},${p[2]}`);
  p[1] = +y.toFixed(2);
}

// --- 4) recompute left-hand normals ---------------------------------------
const normals = line.map((p, i) => {
  const n = line[(i + 1) % N], pr = line[(i - 1 + N) % N];
  const tx = n[0] - pr[0], tz = n[2] - pr[2];
  const len = Math.hypot(tx, tz) || 1;
  return [-tz / len, tx / len];
});

// --- 5) regenerate spawns + checkpoints from the refined line -------------
const coinSpawns = [];
for (let i = 0; i < N; i++) {
  const [x, y, z] = line[i];
  const [px, pz] = normals[i];
  if (i % 2 === 0) coinSpawns.push([+x.toFixed(2), +(y + 1.2).toFixed(2), +z.toFixed(2)]);
  if (i % 6 === 2) {
    const off = line[i][3] * 0.6;
    coinSpawns.push([+(x + px * off).toFixed(2), +(y + 1.2).toFixed(2), +(z + pz * off).toFixed(2)]);
  }
}
const funSpawns = [];
for (let i = 3; i < N; i += 8) {
  const [x, y, z] = line[i];
  funSpawns.push([+x.toFixed(2), +(y + 1.4).toFixed(2), +z.toFixed(2)]);
}
const fudTypesCycle = ["stationary", "moving", "rotating", "wall", "cluster", "gate", "falling", "ambush"];
const fudSpawns = [];
let fi = 0;
for (let i = 5; i < N; i += 5) {
  const [x, y, z] = line[i];
  const [px, pz] = normals[i];
  const off = (fi % 2 === 0 ? 1 : -1) * line[i][3] * 0.4;
  fudSpawns.push({
    position: [+(x + px * off).toFixed(2), +(y + 1.0).toFixed(2), +(z + pz * off).toFixed(2)],
    type: fudTypesCycle[fi % fudTypesCycle.length],
    waypoint: i,
  });
  fi++;
}
const CP = 14;
const checkpoints = [];
for (let i = 0; i < CP; i++) {
  const wi = Math.round((i / CP) * N) % N;
  checkpoints.push({ index: i, waypoint: wi, position: [line[wi][0], line[wi][1], line[wi][2]] });
}

// --- 6) write ---------------------------------------------------------------
const length = (() => {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const p = line[i], q = line[(i + 1) % N];
    s += Math.hypot(q[0] - p[0], q[2] - p[2]);
  }
  return s;
})();
const cx = line.reduce((s, p) => s + p[0], 0) / N;
const cz = line.reduce((s, p) => s + p[2], 0) / N;

const out = `// AUTO-GENERATED by tools/extractTrack.mjs, then refined by
// tools/refineTrackLine.mjs: heights are real surface raycasts, waypoints are
// snapped/recentered onto the drivable corridor, and halfWidth is wall-aware
// so karts stay on the road. Coordinates are WORLD space (the JSX group
// transform is baked in). Regenerate with:
//   node tools/extractTrack.mjs && node tools/refineTrackLine.mjs

export const trackMeta = {
  centroid: [${cx.toFixed(2)}, ${cz.toFixed(2)}],
  length: ${length.toFixed(1)},
  waypointCount: ${N},
  startWaypoint: 0,
};

// Each waypoint: [x, y, z, halfWidth]
export const racingLine = ${JSON.stringify(line)};

// Left-hand XZ normals per waypoint (for lateral offsets): [nx, nz]
export const racingNormals = ${JSON.stringify(normals.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]))};

export const checkpoints = ${JSON.stringify(checkpoints)};

export const coinSpawns = ${JSON.stringify(coinSpawns)};
export const funSpawns = ${JSON.stringify(funSpawns)};
export const fudSpawns = ${JSON.stringify(fudSpawns)};
`;
fs.writeFileSync("./src/trackData.js", out);
console.log("wrote src/trackData.js  length:", length.toFixed(1), "coins:", coinSpawns.length, "fun:", funSpawns.length, "fud:", fudSpawns.length);
console.log("halfWidth range:", Math.min(...line.map((p) => p[3])).toFixed(1), "-", Math.max(...line.map((p) => p[3])).toFixed(1));
console.log("y range:", Math.min(...line.map((p) => p[1])).toFixed(2), "-", Math.max(...line.map((p) => p[1])).toFixed(2));
