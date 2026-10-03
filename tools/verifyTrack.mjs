// tools/verifyTrack.mjs
// Offline verification that the runtime racing line and the ground sampler
// agree with the drivable road meshes in the track GLB. Mirrors
// src/karts/useGroundSampler.js: it casts the exact downward rays the karts
// cast each frame and reports WHICH mesh answers, so a misnamed skybox/prop
// intercepting the ray (kart clipping/floating) is provable, not guesswork.
//
// Node -> JSX name mapping lives in src/models/Mario-circuit-test.jsx.
// Object_18 is the scenery/skybox mesh and Object_22 a tiny prop; both are
// currently named "ground" there, so the runtime sampler collects them.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { racingLine, racingNormals } from "../src/trackData.js";

const GLB = "./public/models/mario-circuit-test-transformed.glb";
const GROUP_POS = new THREE.Vector3(155, -28, 15);
const GROUP_SCALE = 0.08;
const NON_ROAD_NODES = new Set(["Object_18", "Object_22"]); // scenery skybox + prop

// Same monkey-patching the runtime does.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
const doc = await io.read(GLB);
const root = doc.getRoot();

// One three.js Mesh per primitive, carrying its GLB node name, in world space
// (the JSX group transform of position [155,-28,15] + scale 0.08 is baked on).
const allMeshes = [];
for (const node of root.listNodes()) {
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
    m.name = node.getName();
    m.position.copy(GROUP_POS);
    m.scale.setScalar(GROUP_SCALE);
    m.updateMatrixWorld(true);
    allMeshes.push(m);
  }
}

// "today": every mesh is named *ground* in the JSX, so the sampler takes all.
const todayMeshes = allMeshes;
// "fixed": Object_18/22 renamed to non-ground names in the JSX.
const fixedMeshes = allMeshes.filter((m) => !NON_ROAD_NODES.has(m.name));

console.log("GLB meshes:", allMeshes.map((m) => m.name).join(", "));

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const down = new THREE.Vector3(0, -1, 0);
const origin = new THREE.Vector3();

function sample(meshes, x, z) {
  origin.set(x, 80, z); // exact runtime ray: origin y=80, far=200, straight down
  ray.set(origin, down);
  ray.far = 200;
  const hits = ray.intersectObjects(meshes, false);
  return hits.length ? hits[0] : null;
}

let skyboxHits = 0, roadMiss = 0, yMismatch = 0;
for (let i = 0; i < racingLine.length; i++) {
  const [x, y, z] = racingLine[i];
  const today = sample(todayMeshes, x, z);
  const fixed = sample(fixedMeshes, x, z);
  const flags = [];
  if (today && NON_ROAD_NODES.has(today.object.name)) { flags.push(`SAMPLER->${today.object.name}`); skyboxHits++; }
  if (!fixed) { flags.push("NO-ROAD-HIT"); roadMiss++; }
  else if (Math.abs(fixed.point.y - y) > 1.5) { flags.push(`Y-OFF ${fixed.point.y.toFixed(2)} vs ${y}`); yMismatch++; }
  if (flags.length) {
    console.log(
      `wp${i} (${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}) ` +
      `today=${today ? today.object.name + "@" + today.point.y.toFixed(2) : "MISS"} ` +
      `fixed=${fixed ? fixed.object.name + "@" + fixed.point.y.toFixed(2) : "MISS"} ` +
      flags.join(", ")
    );
  }
}

// Containment keeps karts within (halfWidth - 1.5) of the line; probe those
// edges to confirm drivable ground actually exists there.
let edgeMiss = 0, edgeProbes = 0;
for (let i = 0; i < racingLine.length; i += 2) {
  const [x, , z, half] = racingLine[i];
  const n = racingNormals[i];
  const margin = half - 1.5;
  for (const side of [1, -1]) {
    const px = x + n[0] * margin * side;
    const pz = z + n[1] * margin * side;
    edgeProbes++;
    if (!sample(fixedMeshes, px, pz)) {
      edgeMiss++;
      console.log(`edge-miss wp${i} side=${side} at (${px.toFixed(1)}, ${pz.toFixed(1)})`);
    }
  }
}

console.log("\n== SUMMARY ==");
console.log(`waypoints=${racingLine.length} skybox/prop interceptions(today)=${skyboxHits} road-miss=${roadMiss} y-mismatch=${yMismatch}`);
console.log(`edge probes=${edgeProbes} edge-miss=${edgeMiss}`);
const pass = skyboxHits === 0 && roadMiss === 0 && yMismatch === 0 && edgeMiss === 0;
console.log(pass ? "PASS" : "FAIL (see rows above)");
process.exitCode = pass ? 0 : 1;
