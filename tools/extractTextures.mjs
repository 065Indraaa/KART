// Extract embedded GLB textures as .webp files so they can be inspected.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const buf = fs.readFileSync("./public/models/mario-circuit-test-transformed.glb");
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
let off = 20 + jsonLen;
let bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
  if (type === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + len);
  off += 8 + len;
}
const outDir = path.join(os.tmpdir(), "track-tex");
fs.mkdirSync(outDir, { recursive: true });
for (const img of gltf.images) {
  const view = gltf.bufferViews[img.bufferView];
  const data = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  const ext = data[0] === 0x52 && data[1] === 0x49 ? "webp" : "png";
  const file = path.join(outDir, `${img.name}.${ext}`);
  fs.writeFileSync(file, data);
  console.log(`${img.name} -> ${file} (${view.byteLength} bytes, ${ext})`);
}
