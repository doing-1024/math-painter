import type { Scene, Shape, LabelShape } from '../core/types';
import { getShapeDefinition } from '../core/shapes/registry';
import { GLYPH_FONT_PX } from '../core/constants';

export interface ExportOptions {
  background?: string;
  ink?: string;
  padding?: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tight bounding box of all visible (non-hidden) shapes, expanded by `padding`
 *  world units on every side. Returns null when the scene is empty. Shared by
 *  the SVG and canvas exporters so both crop identically. */
export function sceneBounds(scene: Scene, padding = 24): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visible = scene.order
    .map((id) => scene.shapes[id])
    .filter((s): s is Shape => !!s && !s.hidden);
  for (const shape of visible) {
    const def = getShapeDefinition(shape.type);
    if (!def) continue;
    for (const p of def.bbox(shape)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
}

/**
 * Render the current scene to a PNG-ready canvas: white background, black ink,
 * auto-cropped to content bounds (the editor grab-dots / selection are NOT
 * drawn). Labels are rendered as plain text (a `$...$` math segment is shown
 * verbatim without typesetting in this version). Returns null when the scene
 * is empty. Plugins use this for PNG export.
 */
export function renderSceneToCanvas(scene: Scene, opts: ExportOptions = {}): HTMLCanvasElement | null {
  const bounds = sceneBounds(scene, opts.padding ?? 24);
  if (!bounds) return null;
  const ink = opts.ink ?? '#000000';
  const background = opts.background ?? '#ffffff';
  // 2x internal resolution for a crisper raster; default world units are 1:1
  // with screen pixels, so the output is comfortably large.
  const RES = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) * RES));
  canvas.height = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) * RES));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.translate(-bounds.minX, -bounds.minY);

  // Shapes: forced black ink, scale 1 (the ctx transform already applies RES).
  for (const id of scene.order) {
    const shape = scene.shapes[id];
    if (!shape || shape.hidden) continue;
    const def = getShapeDefinition(shape.type);
    if (!def) continue;
    try {
      const styled: Shape = { ...shape, style: { ...shape.style, stroke: ink, fill: ink } };
      def.draw(ctx, styled, { scale: 1, active: false });
    } catch (error) {
      console.error('[math-painter] export draw error', error);
    }
  }

  // Labels as plain text (no editor overlay in export).
  ctx.fillStyle = ink;
  ctx.font = `${GLYPH_FONT_PX}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of scene.order) {
    const shape = scene.shapes[id];
    if (!shape || shape.hidden || shape.type !== 'label') continue;
    const label = shape as LabelShape;
    const text = label.text;
    const plain = text.startsWith('$') && text.endsWith('$') && text.length >= 2 ? text.slice(1, -1) : text;
    ctx.fillText(plain, label.at.x, label.at.y);
  }

  return canvas;
}
