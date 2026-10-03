import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

// Offline racing-line extraction for Dodge the FUD.
// Reads the track GLB, decodes draco, unions the drivable "ground" meshes,
// and derives an ordered centerline loop + checkpoints + spawn points.
// Approximate (angular-bin medial estimate); tuned later during playtesting.

const GLB = './public/models/mario-circuit-test-transformed.glb';
// Group transform applied in src/models/Mario-circuit-test.jsx:
const GROUP_SCALE = 0.08;
const GROUP_POS = [155, -28, 15];
// Node names rendered as drivable road (plain "ground" + "ground speed"); dirt excluded.
// Object_18 (skybox/scenery, spans +-3400u) and Object_22 (tiny prop) excluded —
// they are not drivable and wreck the centroid/radius estimate.
const GROUND_NODES = new Set([
  'Object_10', 'Object_12', 'Object_13',
  'Object_24', 'Object_25', 'Object_47', 'Object_27',
]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(GLB);
const root = doc.getRoot();

// Collect world-space vertices of the ground meshes.
const pts = [];
for (const node of root.listNodes()) {
  if (!GROUND_NODES.has(node.getName())) continue;
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const arr = pos.getArray();
    const n = pos.getCount();
    for (let i = 0; i < n; i++) {
      // node transforms are identity in this GLB; apply group transform only.
      const x = arr[i * 3] * GROUP_SCALE + GROUP_POS[0];
      const y = arr[i * 3 + 1] * GROUP_SCALE + GROUP_POS[1];
      const z = arr[i * 3 + 2] * GROUP_SCALE + GROUP_POS[2];
      pts.push([x, y, z]);
    }
  }
}
console.log('ground vertices:', pts.length);

// Bounding box + centroid (XZ).
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
let cx = 0, cz = 0;
for (const [x, y, z] of pts) {
  cx += x; cz += z;
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
cx /= pts.length; cz /= pts.length;
console.log('bbox X', minX.toFixed(1), maxX.toFixed(1), 'Z', minZ.toFixed(1), maxZ.toFixed(1), 'Y', minY.toFixed(1), maxY.toFixed(1));
console.log('centroid', cx.toFixed(1), cz.toFixed(1));

// Angular binning around centroid -> median radius per bin (robust centerline).
const B = 180;
const bins = Array.from({ length: B }, () => ({ r: [], y: [] }));
for (const [x, y, z] of pts) {
  const a = Math.atan2(z - cz, x - cx);
  const bi = Math.min(B - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * B));
  const r = Math.hypot(x - cx, z - cz);
  bins[bi].r.push(r);
  bins[bi].y.push(y);
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;

// Per-bin centerline radius = midpoint between inner and outer road edge.
let rad = new Array(B).fill(null);
let widths = new Array(B).fill(8);
let ys = new Array(B).fill((minY + maxY) / 2);
for (let i = 0; i < B; i++) {
  const rs = bins[i].r;
  if (rs.length < 3) continue;
  rs.sort((p, q) => p - q);
  const inner = rs[Math.floor(rs.length * 0.08)];
  const outer = rs[Math.floor(rs.length * 0.92)];
  rad[i] = (inner + outer) / 2;
  widths[i] = Math.max(4, Math.min(28, (outer - inner) / 2));
  ys[i] = mean(bins[i].y);
}
// Fill empty bins by circular interpolation.
const fillCircular = (arr) => {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    if (arr[i] != null) continue;
    let lo = i, hi = i, dl = 0, dh = 0;
    while (arr[(lo - 1 + n) % n] == null && dl < n) { lo = (lo - 1 + n) % n; dl++; }
    while (arr[(hi + 1) % n] == null && dh < n) { hi = (hi + 1) % n; dh++; }
    const a = arr[(lo - 1 + n) % n], b = arr[(hi + 1) % n];
    arr[i] = a != null && b != null ? (a + b) / 2 : (a ?? b ?? 0);
  }
  return arr;
};
fillCircular(rad);
// Circular moving-average smoothing of radius + Y.
const smooth = (arr, k = 5) => {
  const n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = -k; j <= k; j++) { s += arr[(i + j + n) % n]; c++; }
    out[i] = s / c;
  }
  return out;
};
rad = smooth(rad, 6); ys = smooth(ys, 6); widths = smooth(widths, 4);

// Build raw centerline, then resample by arc length to N even waypoints.
const raw = [];
for (let i = 0; i < B; i++) {
  const a = -Math.PI + ((i + 0.5) / B) * 2 * Math.PI;
  raw.push([cx + Math.cos(a) * rad[i], ys[i], cz + Math.sin(a) * rad[i], widths[i]]);
}
// cumulative length
const cum = [0];
for (let i = 1; i <= B; i++) {
  const p = raw[i % B], q = raw[i - 1];
  cum.push(cum[i - 1] + Math.hypot(p[0] - q[0], p[2] - q[2]));
}
const total = cum[B];
const N = 56;
const line = [];
for (let i = 0; i < N; i++) {
  const target = (i / N) * total;
  let j = 1; while (j <= B && cum[j] < target) j++;
  const t = (target - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
  const p = raw[(j - 1) % B], q = raw[j % B];
  line.push([
    +(p[0] + (q[0] - p[0]) * t).toFixed(2),
    +(p[1] + (q[1] - p[1]) * t).toFixed(2),
    +(p[2] + (q[2] - p[2]) * t).toFixed(2),
    +(p[3] + (q[3] - p[3]) * t).toFixed(2),
  ]);
}
console.log('track length (world units):', total.toFixed(1), 'waypoints:', N);

// Tangents + perpendiculars (XZ) for lateral offsets.
const perp = line.map((p, i) => {
  const n = line[(i + 1) % N], pr = line[(i - 1 + N) % N];
  const tx = n[0] - pr[0], tz = n[2] - pr[2];
  const len = Math.hypot(tx, tz) || 1;
  return [-tz / len, tx / len]; // left-hand normal in XZ
});

// Spawn layouts sampled along the line.
const coinSpawns = [];
for (let i = 0; i < N; i++) {
  const [x, y, z] = line[i];
  const [px, pz] = perp[i];
  // central coin trail every other waypoint
  if (i % 2 === 0) coinSpawns.push([+(x).toFixed(2), +(y + 1.2).toFixed(2), +(z).toFixed(2)]);
  // risky outer line of coins on some stretches
  if (i % 6 === 2) {
    const off = line[i][3] * 0.7;
    coinSpawns.push([+(x + px * off).toFixed(2), +(y + 1.2).toFixed(2), +(z + pz * off).toFixed(2)]);
  }
}
const funSpawns = [];
for (let i = 3; i < N; i += 8) {
  const [x, y, z] = line[i];
  funSpawns.push([+(x).toFixed(2), +(y + 1.4).toFixed(2), +(z).toFixed(2)]);
}
const fudTypesCycle = ['stationary', 'moving', 'rotating', 'wall', 'cluster', 'gate', 'falling', 'ambush'];
const fudSpawns = [];
let fi = 0;
for (let i = 5; i < N; i += 5) {
  const [x, y, z] = line[i];
  const [px, pz] = perp[i];
  const off = (fi % 2 === 0 ? 1 : -1) * line[i][3] * 0.45;
  fudSpawns.push({
    position: [+(x + px * off).toFixed(2), +(y + 1.0).toFixed(2), +(z + pz * off).toFixed(2)],
    type: fudTypesCycle[fi % fudTypesCycle.length],
    waypoint: i,
  });
  fi++;
}

// Checkpoints: subsample the line; waypoint 0 is start/finish.
const CP = 14;
const checkpoints = [];
for (let i = 0; i < CP; i++) {
  const wi = Math.round((i / CP) * N) % N;
  checkpoints.push({ index: i, waypoint: wi, position: [line[wi][0], line[wi][1], line[wi][2]] });
}

const out = `// AUTO-GENERATED by tools/extractTrack.mjs — offline racing-line extraction.
// Approximate centerline of the drivable 'ground' meshes (angular-bin medial
// estimate), resampled by arc length. Coordinates are WORLD space (the track
// group transform is already baked in). Refine during playtesting if needed.

export const trackMeta = {
  centroid: [${cx.toFixed(2)}, ${cz.toFixed(2)}],
  length: ${total.toFixed(1)},
  waypointCount: ${N},
  startWaypoint: 0,
};

// Each waypoint: [x, y, z, halfWidth]
export const racingLine = ${JSON.stringify(line)};

// Left-hand XZ normals per waypoint (for lateral offsets): [nx, nz]
export const racingNormals = ${JSON.stringify(perp.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]))};

export const checkpoints = ${JSON.stringify(checkpoints)};

export const coinSpawns = ${JSON.stringify(coinSpawns)};
export const funSpawns = ${JSON.stringify(funSpawns)};
export const fudSpawns = ${JSON.stringify(fudSpawns)};
`;
fs.writeFileSync('./src/trackData.js', out);
console.log('wrote src/trackData.js  coins:', coinSpawns.length, 'fun:', funSpawns.length, 'fud:', fudSpawns.length, 'checkpoints:', checkpoints.length);
console.log('sample line[0..3]:', JSON.stringify(line.slice(0, 4)));
