import type { Scene, Shape } from '../core/types';
import { getShapeDefinition } from '../core/shapes/registry';

const PAD = 24;

export interface SVGOptions {
  background?: string;
  ink?: string;
}

export function sceneToSVG(scene: Scene, opts: SVGOptions = {}): string {
  const ink = opts.ink ?? '#1a1a1a';
  const background = opts.background ?? '#ffffff';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visible = scene.order.map((id) => scene.shapes[id]).filter((s): s is Shape => !!s && !s.hidden);
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
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }
  minX -= PAD;
  minY -= PAD;
  maxX += PAD;
  maxY += PAD;
  const width = maxX - minX;
  const height = maxY - minY;
  const body = visible
    .map((shape) => getShapeDefinition(shape.type)?.toSVG(shape, { ink }) ?? '')
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n` +
    `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${background}"/>\n  ${body}\n</svg>\n`;
}
