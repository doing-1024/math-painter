/**
 * Low-level JSON value guards shared by the importer and by every shape
 * definition's `parse` method. Lives in `core` (not `io`) so that shape
 * definitions can validate their own fields without creating a core -> io
 * dependency.
 */
import type { Vec, Style } from './types';

/** Escape a string for safe inclusion in SVG/XML text content. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseVec(value: unknown): Vec | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  return { x: value.x, y: value.y };
}

export function parseStyle(value: unknown): Style | null {
  if (!isRecord(value) || typeof value.stroke !== 'string' || typeof value.fill !== 'string' || !isFiniteNumber(value.width)) return null;
  if (value.width <= 0 || value.width > 100) return null;
  return { stroke: value.stroke, fill: value.fill, width: value.width };
}

/** Build the common SVG stroke attributes used by every shape's `toSVG`. */
export function strokeAttr(style: Style, ink: string): string {
  return `stroke="${ink}" stroke-width="${style.width}" fill="none"`;
}
