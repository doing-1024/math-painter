import type { Scene, Vec } from './types';
import { getShapeDefinition } from './shapes/registry';
import { normalizeAngle, distToSegment } from './geometry';
import { ANGLE_ARC_RADIUS_PX } from './constants';

/** Distance from a point to the sampled arc curve between two directions.
 *  `r` is the (world) arc radius, which the caller derives from scale. */
export function distToAngleArc(vertex: Vec, dirA: Vec, dirB: Vec, world: Vec, r: number): number {
  const angA = Math.atan2(dirA.y, dirA.x);
  const angB = Math.atan2(dirB.y, dirB.x);
  const sweep = normalizeAngle(angB - angA);
  const n = 16;
  let previous = { x: vertex.x + r * Math.cos(angA), y: vertex.y + r * Math.sin(angA) };
  for (let i = 1; i <= n; i++) {
    const angle = angA + (sweep * i) / n;
    const current = { x: vertex.x + r * Math.cos(angle), y: vertex.y + r * Math.sin(angle) };
    const d = distToSegment(world, previous, current);
    if (d < r / n) return d;
    previous = current;
  }
  return Infinity;
}

/**
 * Snap `world` to the nearest edge within `tolPx` screen pixels, so picking a
 * side feels like it auto-attaches to the edge. Returns `world` unchanged when
 * nothing is close enough. Every shape reports its own nearest point via the
 * registry, so there is no central type switch.
 */
export function snapToEdge(scene: Scene, world: Vec, scale: number, tolPx = 14, exclude?: Set<string> | null): Vec {
  let bestId: string | null = null;
  let bestD = Infinity;
  for (const id of scene.order) {
    if (exclude && exclude.has(id)) continue;
    const shape = scene.shapes[id];
    if (!shape) continue;
    const nearest = getShapeDefinition(shape.type)?.nearest(shape, world);
    if (!nearest) continue;
    if (nearest.dist < bestD) {
      bestD = nearest.dist;
      bestId = id;
    }
  }
  const tolerance = tolPx / scale;
  if (bestId && bestD < tolerance) {
    const shape = scene.shapes[bestId];
    return getShapeDefinition(shape.type)!.nearest(shape, world).point;
  }
  return world;
}

/** Re-exported for convenience: the screen-fixed angle arc radius. */
export const ANGLE_ARC_RADIUS = ANGLE_ARC_RADIUS_PX;
