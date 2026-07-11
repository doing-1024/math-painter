import type { Scene, Shape } from '../core/types';
import { getShapeDefinition } from '../core/shapes/registry';
import { isRecord, parseStyle } from '../core/parse';

/** Thrown by the importer with the first concrete reason a scene is invalid,
 *  so the UI can show an actionable message instead of a bare "IMPORT ERROR". */
export class ParseError extends Error {
  id?: string;
  constructor(message: string, id?: string) {
    super(message);
    this.name = 'ParseError';
    this.id = id;
  }
}

export function parseShape(value: unknown, id: string): Shape | null {
  if (!isRecord(value) || value.id !== id || typeof value.type !== 'string') return null;
  const style = parseStyle(value.style);
  if (!style) return null;
  // Legacy 'measure' shapes are treated as free labels.
  const type = value.type === 'measure' ? 'label' : value.type;
  const def = getShapeDefinition(type);
  if (!def) return null;
  const shape = def.parse(value, id, style);
  if (!shape) return null;
  return value.hidden === true ? { ...shape, hidden: true } : shape;
}

export function parseScene(value: unknown): Scene {
  if (!isRecord(value) || !isRecord(value.shapes) || !Array.isArray(value.order)) {
    throw new ParseError('scene must be an object with "shapes" and "order"');
  }
  // Reject keys that would corrupt the shapes map (prototype pollution).
  for (const key of Object.keys(value.shapes)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new ParseError(`forbidden key: ${key}`);
    }
  }
  const order = (value.order as unknown[]).filter((id): id is string => typeof id === 'string');
  if (order.length !== value.order.length || new Set(order).size !== order.length) {
    throw new ParseError('order has duplicates or non-string ids');
  }
  // Object.create(null) so no prototype keys can be injected via the JSON.
  const shapes: Record<string, Shape> = Object.create(null);
  for (const [id, shapeValue] of Object.entries(value.shapes)) {
    const shape = parseShape(shapeValue, id);
    if (!shape) throw new ParseError('invalid shape', id);
    shapes[id] = shape;
  }
  if (order.some((id) => !shapes[id])) throw new ParseError('order references a missing shape');
  if (Object.keys(shapes).some((id) => !order.includes(id))) throw new ParseError('shapes not present in order');
  return { shapes, order };
}

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene, null, 2);
}

export const MAX_IMPORT_BYTES = 2_000_000;
