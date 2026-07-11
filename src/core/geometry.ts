import type { Vec } from './types';

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Vector subtraction. */
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

/** Normalize a vector to unit length (zero vector stays zero). */
export const normalizeVec = (v: Vec): Vec => {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-9 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};

/** Dot product of two vectors. */
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;

/** Absolute angle (radians) between two direction vectors, in [0, PI]. */
export const angleBetweenDirs = (a: Vec, b: Vec): number => {
  const c = dot(normalizeVec(a), normalizeVec(b));
  return Math.acos(Math.max(-1, Math.min(1, c)));
};

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len));
  return dist(p, { x: a.x + vx * t, y: a.y + vy * t });
}

/** Project a point onto segment a-b (clamped to the segment). */
export function projectOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return { ...a };
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + vx * t, y: a.y + vy * t };
}

/** Translate a point by `delta`. */
export const move = (p: Vec, d: Vec): Vec => ({ x: p.x + d.x, y: p.y + d.y });

export const pointsEqual = (a: Vec, b: Vec, eps = 1e-6): boolean => dist(a, b) < eps;

/** Minimum radius (world units) used to reject degenerate circles/arcs. */
export const MIN_RADIUS = 1e-3;

/** Normalize an angle to the range (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let x = angle % (2 * Math.PI);
  if (x <= -Math.PI) x += 2 * Math.PI;
  if (x > Math.PI) x -= 2 * Math.PI;
  return x;
}

/** Degrees -> radians. */
export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Radians -> degrees. */
export const radToDeg = (radians: number): number => (radians * 180) / Math.PI;

/** Snap a value to the nearest multiple of step. */
export function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Clamp a coordinate to a finite, bounded range to avoid NaN / overflow. */
export function finiteCoord(value: number, max = 1e7): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-max, Math.min(max, value));
}

export function finiteVec(v: Vec): Vec {
  return { x: finiteCoord(v.x), y: finiteCoord(v.y) };
}

/** Midpoint of two points. */
export const midpoint = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(points: Vec[], p: Vec): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The straight edge a polygon presents at `world`: the nearest edge between two
 * adjacent vertices. Shapes without a straight edge return null (see
 * `shapeEdgeAt` in the registry, which dispatches to a shape's own `edgeAt`).
 */
export function polygonEdgeAt(points: Vec[], world: Vec): { a: Vec; b: Vec } | null {
  let best: { a: Vec; b: Vec } | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = distToSegment(world, a, b);
    if (d < bestDist) {
      bestDist = d;
      best = { a, b };
    }
  }
  return best;
}

/**
 * Vertices of a regular n-gon whose first edge is the directed segment
 * v0 -> v1 (defines side length and orientation). The polygon is laid out on
 * the left of that edge (counter-clockwise). Returns the vertices in order,
 * starting at v0, so the generated first edge equals the input edge exactly.
 */
export function regularPolygon(v0: Vec, v1: Vec, n: number): Vec[] {
  const L = dist(v0, v1);
  if (L <= 1e-6 || n < 3) return [v0, v1];
  const theta = Math.atan2(v1.y - v0.y, v1.x - v0.x);
  const apothem = L / (2 * Math.tan(Math.PI / n));
  const m = midpoint(v0, v1);
  const nx = -Math.sin(theta);
  const ny = Math.cos(theta);
  const c: Vec = { x: m.x + apothem * nx, y: m.y + apothem * ny };
  const R = L / (2 * Math.sin(Math.PI / n));
  const phi0 = Math.atan2(v0.y - c.y, v0.x - c.x);
  const pts: Vec[] = [];
  for (let k = 0; k < n; k++) {
    const phi = phi0 + (k * 2 * Math.PI) / n;
    pts.push({ x: c.x + R * Math.cos(phi), y: c.y + R * Math.sin(phi) });
  }
  return pts;
}


