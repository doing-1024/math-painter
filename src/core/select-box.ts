import type { Scene, Vec } from './types';
import { shapeBBox } from './shapes/registry';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Build a normalized (min/max) rect from two opposite corners. */
export function normalizeRect(a: Vec, b: Vec): Rect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

/**
 * Ids of the shapes whose geometry intersects the selection rect. Hidden
 * shapes (construction lines) are never box-selected. A shape is selected when
 * any of its sample points falls inside the rect, when the rect overlaps its
 * bounding box, or when the rect is fully contained by the shape.
 */
export function boxSelectionIds(scene: Scene, rect: Rect): string[] {
  const inRect = (p: Vec): boolean => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
  const result: string[] = [];
  for (const id of scene.order) {
    const shape = scene.shapes[id];
    if (!shape || shape.hidden) continue;
    const pts = shapeBBox(shape);
    if (pts.length === 0) continue;
    if (pts.some(inRect)) {
      result.push(id);
      continue;
    }
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (const p of pts) {
      if (p.x < bx0) bx0 = p.x;
      if (p.y < by0) by0 = p.y;
      if (p.x > bx1) bx1 = p.x;
      if (p.y > by1) by1 = p.y;
    }
    const corners = [
      [rect.x0, rect.y0],
      [rect.x1, rect.y0],
      [rect.x0, rect.y1],
      [rect.x1, rect.y1],
    ];
    const overlaps = corners.some(([x, y]) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1);
    const contains = rect.x0 >= bx0 && rect.x1 <= bx1 && rect.y0 >= by0 && rect.y1 <= by1;
    if (overlaps || contains) result.push(id);
  }
  return result;
}
