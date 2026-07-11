import type { Vec, Scene } from './types';
import { anchorsOf } from './shapes/registry';
import { pointsEqual } from './geometry';
import { snapToEdge } from './angle';

export function snapToAnchors(anchors: Vec[], world: Vec, tolerance: number): Vec | null {
  let best: Vec | null = null;
  let bestDistance = tolerance;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.x - world.x, anchor.y - world.y);
    if (distance <= bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

export function sceneAnchors(scene: Scene): Vec[] {
  const result: Vec[] = [];
  for (const id of scene.order) {
    const shape = scene.shapes[id];
    if (shape) result.push(...anchorsOf(shape));
  }
  return result;
}

export function snapWorld(scene: Scene, world: Vec, tolerance: number, extra: Vec[] = []): Vec | null {
  return snapToAnchors([...extra, ...sceneAnchors(scene)], world, tolerance);
}

/**
 * Unified point picking with snapping. Anchor snapping (existing geometric
 * points: vertices, endpoints, centers, labels) takes priority within a 10px
 * tolerance; if nothing is within reach, it falls back to edge snapping (the
 * nearest point on any shape) within a 14px tolerance. Returns the chosen
 * point and the snap target (null when the point was left free). This is the
 * single abstraction every drawing tool should use for picking a point, so
 * that snapping stays consistent and the core stays lean.
 */
export function pickPoint(
  scene: Scene,
  world: Vec,
  scale: number,
  extra: Vec[] = [],
  exclude?: Set<string> | null,
): { point: Vec; snap: Vec | null } {
  // Anchor phase: scene anchors (skipping excluded shapes) plus transient extras.
  const anchors: Vec[] = [...extra];
  for (const id of scene.order) {
    if (exclude && exclude.has(id)) continue;
    const shape = scene.shapes[id];
    if (shape) anchors.push(...anchorsOf(shape));
  }
  const anchor = snapToAnchors(anchors, world, 10 / scale);
  if (anchor) return { point: { ...anchor }, snap: { ...anchor } };
  // Edge phase: nearest point on any (non-excluded) shape within tolerance.
  const edge = snapToEdge(scene, world, scale, 14, exclude);
  if (!pointsEqual(edge, world)) return { point: edge, snap: edge };
  return { point: world, snap: null };
}
