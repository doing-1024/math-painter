import type { Shape, Vec, Scene, Style } from '../types';

export interface ShapeRenderOpts {
  scale: number;
  active: boolean;
}

/** Context handed to a shape's `toSVG` so it can render print-friendly output. */
export interface SVGContext {
  ink: string;
}

/**
 * Everything the core needs to know about a concrete shape type. A shape owns
 * ALL of its behaviour here — there is no central `switch (shape.type)` anywhere
 * in core/io/app. To add a shape you implement this interface and call
 * `registerShape`; nothing else changes.
 */
export interface ShapeDefinition<T extends Shape = Shape> {
  type: T['type'];
  /** Structural snap/selection anchors (vertices, endpoints, centers...). */
  anchors(shape: T): Vec[];
  /** True when `world` is within `tolerance` (world units) of the shape. */
  hit(shape: T, world: Vec, tolerance: number): boolean;
  /** Draw the shape onto the (world-transformed) 2D context. */
  draw(ctx: CanvasRenderingContext2D, shape: T, opts: ShapeRenderOpts): void;
  /** Translate the shape by `delta` (used by drag-move). */
  translate(shape: T, delta: Vec): T;
  /** Nearest point on the shape to `world` and its distance (for edge snapping). */
  nearest(shape: T, world: Vec): { point: Vec; dist: number };
  /** Sample points used to compute the figure's bounding box for SVG export. */
  bbox(shape: T): Vec[];
  /** Print-friendly SVG fragment for the shape. */
  toSVG(shape: T, ctx: SVGContext): string;
  /** Parse a raw JSON value into a validated shape, or null if invalid. */
  parse(value: unknown, id: string, style: Style): T | null;
  /** The straight edge presented at `world`, if the shape has one (so tick
   *  marks and edge picking treat polygon edges like ordinary segments). */
  edgeAt?(shape: T, world: Vec): { a: Vec; b: Vec } | null;
  /** Extra shape ids that should be deleted together with this one. */
  cascadeIds?(shape: T): string[];
}

const registry = new Map<string, ShapeDefinition>();

export function registerShape<T extends Shape>(definition: ShapeDefinition<T>): void {
  registry.set(definition.type, definition as ShapeDefinition);
}

export function getShapeDefinition(type: string): ShapeDefinition | undefined {
  return registry.get(type);
}

export function anchorsOf(shape: Shape): Vec[] {
  return getShapeDefinition(shape.type)?.anchors(shape) ?? [];
}

export function hitShape(shape: Shape, world: Vec, tolerance: number): boolean {
  return getShapeDefinition(shape.type)?.hit(shape, world, tolerance) ?? false;
}

export function hitTest(scene: Scene, world: Vec, scale: number): string | null {
  const tolerance = 8 / scale;
  for (const id of [...scene.order].reverse()) {
    const shape = scene.shapes[id];
    if (!shape) continue;
    if (hitShape(shape, world, tolerance)) return id;
  }
  return null;
}

/** Move a shape by `delta` via its own definition. Falls back to the original
 *  shape only if no definition is registered (should never happen). */
export function translateShape(shape: Shape, delta: Vec): Shape {
  return getShapeDefinition(shape.type)?.translate(shape, delta) ?? shape;
}

/** Resolve the straight edge a shape presents at `world`, or null. */
export function shapeEdgeAt(shape: Shape, world: Vec): { a: Vec; b: Vec } | null {
  return getShapeDefinition(shape.type)?.edgeAt?.(shape, world) ?? null;
}

/** Nearest point on the shape to `world` and its distance (for edge snapping). */
export function nearestOnShape(shape: Shape, world: Vec): { point: Vec; dist: number } {
  return getShapeDefinition(shape.type)?.nearest(shape, world) ?? { point: world, dist: Infinity };
}
