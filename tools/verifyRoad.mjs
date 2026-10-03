// tools/verifyRoad.mjs — assert that every race entity sits on the drivable
// road (down-raycast over the ground meshes), matching the runtime sampler.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { racingLine, coinSpawns, funSpawns, fudSpawns } from "../src/trackData.js";

const GLB = "./public/models/mario-circuit-test-transformed.glb";
const NON_DRIVABLE = new Set(["Object_18", "Object_22"]);
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
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
    m.position.set(155, -28, 15);
    m.scale.setScalar(0.08);
    m.updateMatrixWorld(true);
    meshes.push(m);
  }
}

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const DOWN = new THREE.Vector3(0, -1, 0);
const ORIGIN = new THREE.Vector3();
function groundY(x, z) {
  ORIGIN.set(x, 80, z);
  ray.set(ORIGIN, DOWN);
  ray.far = 200;
  const hits = ray.intersectObjects(meshes, false);
  return hits.length ? hits[0].point.y : null;
}

let fails = 0;
function check(name, arr, heightTolerance = 1.5) {
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    const pos = Array.isArray(p) ? p : p.position;
    const y = groundY(pos[0], pos[2]);
    if (y == null) { console.log(`FAIL ${name}[${i}] off-road at (${pos[0].toFixed(1)},${pos[2].toFixed(1)})`); fails++; }
    else if (Math.abs(y - pos[1]) > heightTolerance) { console.log(`FAIL ${name}[${i}] float y=${pos[1].toFixed(1)} vs ground=${y.toFixed(1)} at (${pos[0].toFixed(1)},${pos[2].toFixed(1)})`); fails++; }
  }
  console.log(`${name}: ${arr.length} checked`);
}

check("waypoint", racingLine, 0.3);
check("coin", coinSpawns);
check("fun", funSpawns);
check("fud", fudSpawns);

// start-line banner anchor points (computed in StartGate props)
const wp = racingLine[0];
const n = [0.968, 0.252];
const left = [wp[0] + n[0] * 24, wp[1] + 7, wp[2] + n[1] * 24];
const right = [wp[0] - n[0] * 24, wp[1] + 7, wp[2] - n[1] * 24];
for (const [name, p] of [["banner-left", left], ["banner-right", right]]) {
  const y = groundY(p[0], p[2]);
  if (y == null) { console.log(`FAIL ${name} pole off-road`); fails++; }
  else console.log(`${name} ground y=${y.toFixed(2)}`);
}

console.log(fails === 0 ? "PASS" : `FAIL (${fails})`);
process.exitCode = fails === 0 ? 0 : 1;
