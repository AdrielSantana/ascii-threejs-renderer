/**
 * Procedural shape targets for particle morphing.
 *
 * Each generator writes `count * 3` floats (xyz per particle) into a
 * caller-provided buffer. Positions are scaled to roughly match the vortex
 * sphere (radius ~2.18) so morphs don't shrink the silhouette.
 */

export type ShapeName = 'cube' | 'torus' | 'torusKnot' | 'galaxy';

export const SHAPE_NAMES: readonly ShapeName[] = ['cube', 'torus', 'torusKnot', 'galaxy'];

export function generateShape(name: ShapeName, count: number, out: Float32Array): void {
  switch (name) {
    case 'cube':
      return generateCube(count, out);
    case 'torus':
      return generateTorus(count, out);
    case 'torusKnot':
      return generateTorusKnot(count, out);
    case 'galaxy':
      return generateGalaxy(count, out);
  }
}

// Half-extent chosen so face centers (~1.70) and corners (~2.94) bracket the
// vortex sphere's radius (~2.18), keeping the silhouette comparable.
const CUBE_HALF = 1.7;

function generateCube(count: number, out: Float32Array) {
  for (let i = 0; i < count; i++) {
    const face = Math.floor(Math.random() * 6);
    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;
    const h = CUBE_HALF;
    const i3 = i * 3;
    // face index → +X, -X, +Y, -Y, +Z, -Z
    switch (face) {
      case 0: out[i3] = h;     out[i3 + 1] = u * h; out[i3 + 2] = v * h; break;
      case 1: out[i3] = -h;    out[i3 + 1] = u * h; out[i3 + 2] = v * h; break;
      case 2: out[i3] = u * h; out[i3 + 1] = h;     out[i3 + 2] = v * h; break;
      case 3: out[i3] = u * h; out[i3 + 1] = -h;    out[i3 + 2] = v * h; break;
      case 4: out[i3] = u * h; out[i3 + 1] = v * h; out[i3 + 2] = h;     break;
      case 5: out[i3] = u * h; out[i3 + 1] = v * h; out[i3 + 2] = -h;    break;
    }
  }
}

function generateTorus(count: number, out: Float32Array) {
  const R = 1.4; // major
  const r = 0.45; // minor
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const i3 = i * 3;
    const rr = R + r * Math.cos(v);
    out[i3] = rr * Math.cos(u);
    out[i3 + 1] = r * Math.sin(v);
    out[i3 + 2] = rr * Math.sin(u);
  }
}

// Standard (p=2, q=3) torus knot — single continuous curve.
// Sample t uniformly across [0, 1] across many cycles to spread particles.
function generateTorusKnot(count: number, out: Float32Array) {
  const p = 2;
  const q = 3;
  const R = 1.2;
  const tube = 0.32;
  for (let i = 0; i < count; i++) {
    // Random sample across [0, 4π] — full length of the curve
    const t = Math.random() * Math.PI * 4;
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    const csq = Math.cos(p * t / q);
    const beta = R + csq * 0.6;
    const i3 = i * 3;
    // Curve center
    const cx = beta * Math.cos(p * t);
    const cy = beta * Math.sin(p * t);
    const cz = csq * 0.6;
    // Tube offset (random angle around the curve)
    const phi = Math.random() * Math.PI * 2;
    // Roughly tangent-normal frame for tube displacement
    const nx = -Math.sin(p * t) * cs;
    const ny = Math.cos(p * t) * cs;
    const nz = sn;
    const tx = -Math.cos(p * t) * p;
    const ty = -Math.sin(p * t) * p;
    const tz = 0;
    // perpendicular in frame
    const px = ny * tz - nz * ty;
    const py = nz * tx - nx * tz;
    const pz = nx * ty - ny * tx;
    const pl = Math.hypot(px, py, pz) || 1;
    const offset = tube * Math.cos(phi);
    out[i3] = cx + (px / pl) * offset;
    out[i3 + 1] = cy + (py / pl) * offset;
    out[i3 + 2] = cz + (pz / pl) * offset;
  }
}

// 4-arm log-spiral galaxy. Particles concentrate toward center via pow()
// and scatter perpendicular to the arm to give it "width".
function generateGalaxy(count: number, out: Float32Array) {
  const ARMS = 4;
  const ARM_SPREAD = 0.25; // rad perpendicular scatter
  const RADIAL_SCATTER = 0.1;
  const SPIN = 1.0; // arm twist factor
  for (let i = 0; i < count; i++) {
    const arm = Math.floor(Math.random() * ARMS);
    const radius = 0.2 + 1.9 * Math.pow(Math.random(), 0.65);
    // Log spiral: angle grows with radius
    const branchAngle = arm * (Math.PI * 2 / ARMS);
    const spinAngle = radius * SPIN;
    const scatter = (Math.random() - 0.5) * 2 * ARM_SPREAD;
    const angle = branchAngle + spinAngle + scatter;
    const r = radius + (Math.random() - 0.5) * 2 * RADIAL_SCATTER;
    const i3 = i * 3;
    // Galaxy in XZ plane (matches vortex equator), small Y thickness
    out[i3] = Math.cos(angle) * r;
    out[i3 + 1] = (Math.random() - 0.5) * 0.18 * Math.pow(radius, 0.5);
    out[i3 + 2] = Math.sin(angle) * r;
  }
}
