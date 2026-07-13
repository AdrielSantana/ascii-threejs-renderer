import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads a GLB model and samples N points uniformly across its surface.
 *
 * The result is a Float32Array of `count * 3` floats (xyz per particle),
 * matching the format expected by the vortex wallpaper's `aTarget` attribute.
 * Points are scaled to roughly match the vortex sphere radius (~2.18).
 *
 * Sampling is area-weighted: larger triangles get proportionally more points,
 * so the particle distribution reflects the actual surface geometry.
 *
 * Also returns a `densityRatio` (surfaceArea / maxProjectedArea) that the
 * caller can use to adjust particle size — thin shapes like a katana have
 * a high ratio (lots of surface, small silhouette) and need smaller points
 * to avoid over-densification.
 */

const TARGET_RADIUS = 2.18;
const SPHERE_DENSITY_RATIO = 4; // sphere: 4πr² / πr² = 4 (our reference)

const cache = new Map<string, { points: Float32Array; surfaceArea: number; densityRatio: number }>();
const loader = new GLTFLoader();

export interface GlbShapeOptions {
  /** Initial rotation in radians (Euler XYZ) applied to sampled points */
  rotation?: [number, number, number];
}

export interface GlbShapeResult {
  points: Float32Array;
  /** Total surface area of the model (in model units, before scaling) */
  surfaceArea: number;
  /** surfaceArea / maxProjectedArea. Sphere = 4. Thin shapes > 10. */
  densityRatio: number;
  /** Recommended point size multiplier: sqrt(SPHERE_RATIO / densityRatio) */
  pointSizeMul: number;
}

export async function loadGlbShape(
  url: string,
  count: number,
  options?: GlbShapeOptions,
): Promise<GlbShapeResult> {
  const cacheKey = `${url}#${count}#${JSON.stringify(options?.rotation ?? [])}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    const pointSizeMul = Math.sqrt(SPHERE_DENSITY_RATIO / cached.densityRatio);
    return { ...cached, pointSizeMul };
  }

  const gltf = await loader.loadAsync(url);

  // CRITICAL: update world matrices before reading them, otherwise child meshes
  // with parent transforms (common in rigged/multi-part GLB models) will have
  // identity matrices and parts will be misaligned.
  gltf.scene.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });

  // Collect triangles from all meshes, transforming to world space
  const triangles: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number }[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const index = geo.index;
    const matrix = mesh.matrixWorld;

    const getVertex = (i: number, target: THREE.Vector3) => {
      target.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    };

    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      if (index) {
        getVertex(index.getX(t * 3), tmpA);
        getVertex(index.getX(t * 3 + 1), tmpB);
        getVertex(index.getX(t * 3 + 2), tmpC);
      } else {
        getVertex(t * 3, tmpA);
        getVertex(t * 3 + 1, tmpB);
        getVertex(t * 3 + 2, tmpC);
      }
      ab.subVectors(tmpB, tmpA);
      ac.subVectors(tmpC, tmpA);
      cross.crossVectors(ab, ac);
      const area = cross.length() * 0.5;
      if (area > 1e-8) {
        triangles.push({
          a: tmpA.clone(),
          b: tmpB.clone(),
          c: tmpC.clone(),
          area,
        });
      }
    }
  }

  if (triangles.length === 0) {
    throw new Error(`No triangles found in ${url}`);
  }

  // Total surface area
  const totalArea = triangles.reduce((sum, t) => sum + t.area, 0);

  // Build cumulative area distribution for weighted sampling
  const cumulative: number[] = [];
  let acc = 0;
  for (const t of triangles) {
    acc += t.area / totalArea;
    cumulative.push(acc);
  }

  // Compute bounding box for scaling
  const box = new THREE.Box3();
  for (const t of triangles) {
    box.expandByPoint(t.a);
    box.expandByPoint(t.b);
    box.expandByPoint(t.c);
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = (TARGET_RADIUS * 2) / maxDim;
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Density ratio: surfaceArea / maxProjectedArea
  // maxProjectedArea ≈ largest face of bounding box (XY, XZ, or YZ plane)
  const projectedXY = size.x * size.y;
  const projectedXZ = size.x * size.z;
  const projectedYZ = size.y * size.z;
  const maxProjected = Math.max(projectedXY, projectedXZ, projectedYZ);
  const densityRatio = totalArea / maxProjected;
  const pointSizeMul = Math.sqrt(SPHERE_DENSITY_RATIO / densityRatio);

  // Precompute rotation matrix if provided
  const rot = options?.rotation;
  const rotMatrix = new THREE.Matrix4();
  if (rot) rotMatrix.makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));

  // Sample `count` points
  const out = new Float32Array(count * 3);
  const tmp = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    // Pick a triangle via inverse-CDF sampling
    const r = Math.random();
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const tri = triangles[lo];

    // Random barycentric coordinates
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;

    tmp.set(
      (tri.a.x * w + tri.b.x * u + tri.c.x * v - center.x) * scale,
      (tri.a.y * w + tri.b.y * u + tri.c.y * v - center.y) * scale,
      (tri.a.z * w + tri.b.z * u + tri.c.z * v - center.z) * scale,
    );
    if (rot) tmp.applyMatrix4(rotMatrix);

    const i3 = i * 3;
    out[i3] = tmp.x;
    out[i3 + 1] = tmp.y;
    out[i3 + 2] = tmp.z;
  }

  cache.set(cacheKey, { points: out, surfaceArea: totalArea, densityRatio });
  return { points: out, surfaceArea: totalArea, densityRatio, pointSizeMul };
}
