// aiMath.js — pure scalar / XZ-plane helpers for the kart AI "brain".
// No React, no three.js. Everything here is allocation-free and deterministic.
// All vector math is 2D in the XZ plane (Y is up and ignored for driving).

export const TAU = Math.PI * 2;

/** Clamp v into [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolate a -> b by t. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep-ish 0..1 ramp of x across [edge0, edge1]. */
export function ramp(x, edge0, edge1) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  return clamp((x - edge0) / (edge1 - edge0), 0, 1);
}

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// --------------------------------------------------------------------------
// Heading convention (MUST match the physics engine):
//   forward = (-sin(heading), 0, -cos(heading))
// so the heading that points along an XZ direction (dx, dz) is:
//   heading = atan2(-dx, -dz)
// and steer > 0 (turn LEFT) increases heading. The signed steering error is
// therefore wrapAngle(headingOf(dir) - currentHeading): positive => steer left.
// --------------------------------------------------------------------------

/** Heading (radians) whose forward vector points along (dx, dz). */
export function headingOf(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/** Forward X component for a heading. */
export function fwdX(h) {
  return -Math.sin(h);
}

/** Forward Z component for a heading. */
export function fwdZ(h) {
  return -Math.cos(h);
}

// Mulberry32: tiny, fast, deterministic PRNG. Returns a function -> [0, 1).
export function makePRNG(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit string hash — used to seed a per-personality PRNG. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
