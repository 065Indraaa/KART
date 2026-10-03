// Ground height sampler shared by every kart. Lazily collects the track's
// "ground" meshes, builds a BVH on each (three-mesh-bvh) and exposes a cheap
// downward raycast so karts can follow the terrain. One raycaster, reused.
import { useThree } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import { Raycaster, Vector3, Mesh, BufferGeometry } from "three";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

export function useGroundSampler() {
  const { scene } = useThree();
  const meshes = useRef([]);
  const ray = useRef(new Raycaster());
  const origin = useRef(new Vector3());
  const down = useRef(new Vector3(0, -1, 0));

  const refresh = useCallback(() => {
    const found = [];
    scene.traverse((o) => {
      if (o.isMesh && o.name && o.name.includes("ground")) {
        if (!o.geometry.boundsTree) {
          try { o.geometry.computeBoundsTree(); } catch { /* non-indexed/empty */ }
        }
        found.push(o);
      }
    });
    meshes.current = found;
    return found.length;
  }, [scene]);

  // Returns ground Y under (x,z), or `fallback` if nothing is hit.
  const sampleGroundY = useCallback((x, z, fallback = 0) => {
    if (meshes.current.length === 0 && refresh() === 0) return fallback;
    origin.current.set(x, 80, z);
    ray.current.set(origin.current, down.current);
    ray.current.far = 200;
    ray.current.firstHitOnly = true;
    const hits = ray.current.intersectObjects(meshes.current, false);
    return hits.length > 0 ? hits[0].point.y : fallback;
  }, [refresh]);

  return { sampleGroundY, refresh };
}
