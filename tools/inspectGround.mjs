import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const GLB = './public/models/mario-circuit-test-transformed.glb';
const S = 0.08, P = [155, -28, 15];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(GLB);
const root = doc.getRoot();

for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9, cnt = 0;
  let cx = 0, cy = 0, cz = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const a = pos.getArray(), n = pos.getCount();
    for (let i = 0; i < n; i++) {
      const x = a[i*3]*S+P[0], y = a[i*3+1]*S+P[1], z = a[i*3+2]*S+P[2];
      cx+=x; cy+=y; cz+=z; cnt++;
      if (x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; if(z<minZ)minZ=z; if(z>maxZ)maxZ=z;
    }
  }
  if (!cnt) continue;
  console.log(
    node.getName().padEnd(12),
    'n=' + String(cnt).padStart(7),
    'X[' + minX.toFixed(0) + ',' + maxX.toFixed(0) + ']',
    'Z[' + minZ.toFixed(0) + ',' + maxZ.toFixed(0) + ']',
    'Y[' + minY.toFixed(0) + ',' + maxY.toFixed(0) + ']',
    'c=(' + (cx/cnt).toFixed(0) + ',' + (cy/cnt).toFixed(0) + ',' + (cz/cnt).toFixed(0) + ')'
  );
}
