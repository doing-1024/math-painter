import type { Scene, Shape } from '../core/types';
import { getShapeDefinition } from '../core/shapes/registry';
import { sceneBounds } from './canvas';

export interface SVGOptions {
  background?: string;
  ink?: string;
  padding?: number;
}

export function sceneToSVG(scene: Scene, opts: SVGOptions = {}): string {
  const ink = opts.ink ?? '#1a1a1a';
  const background = opts.background ?? '#ffffff';
  const fallback = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const b = sceneBounds(scene, opts.padding ?? 24) ?? fallback;
  const minX = b.minX;
  const minY = b.minY;
  const maxX = b.maxX;
  const maxY = b.maxY;
  const width = maxX - minX;
  const height = maxY - minY;
  const visible = scene.order
    .map((id) => scene.shapes[id])
    .filter((s): s is Shape => !!s && !s.hidden);
  const body = visible
    .map((shape) => getShapeDefinition(shape.type)?.toSVG(shape, { ink }) ?? '')
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n` +
    `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${background}"/>\n  ${body}\n</svg>\n`;
}
