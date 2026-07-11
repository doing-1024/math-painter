import type { EditorContext, Tool, PointerInput } from './types';
import type { AngleLabelShape, Vec } from '../core/types';
import type { Overlay } from '../render/renderer';
import { angleBetweenDirs, radToDeg, normalizeAngle, normalizeVec, sub, dist } from '../core/geometry';
import { DEFAULT_STYLE } from '../core/style';

const ARC_R = 26;

/** A label that reads 90 (with or without a degree symbol) marks a right
 *  angle: the square is drawn instead of an arc and no number is shown.
 *  Any other label (e.g. 45) draws that arc with its own number. The
 *  right-angle decision is driven purely by the typed label, never by the
 *  measured geometry, so a ~90° corner can be relabeled 45°. */
function isRightLabel(text: string): boolean {
  const n = Number(text.replace(/[° ]/g, ''));
  return Number.isFinite(n) && Math.round(n) === 90;
}

/** The user types only the number; the program adds the degree symbol.
 *  Numeric input gets `°` appended (any stray symbol is stripped first);
 *  a non-numeric custom label is left untouched. */
function ensureDegree(s: string): string {
  const t = s.replace(/°/g, '').trim();
  if (t === '') return '';
  if (/^-?\d*\.?\d+$/.test(t)) return `${t}°`;
  return t;
}

export class AngleLabelTool implements Tool {
  id = 'angle';
  cursor = 'crosshair';
  private vertex: Vec | null = null;
  private p1: Vec | null = null;
  private dirA: Vec | null = null;
  private mouse: Vec | null = null;

  activate(): void {
    this.reset();
  }

  private reset(): void {
    this.vertex = null;
    this.p1 = null;
    this.dirA = null;
    this.mouse = null;
  }

  pointerMove(ctx: EditorContext, e: PointerInput): void {
    this.mouse = ctx.snap(e.rawWorld);
  }

  async pointerDown(ctx: EditorContext, e: PointerInput): Promise<void> {
    if (!this.vertex) {
      this.vertex = ctx.snap(e.rawWorld);
      ctx.setStatus('ANGLE: pick a point on the 1st side');
      ctx.draw();
      return;
    }
    const vertex = this.vertex;
    if (!this.p1) {
      const at = ctx.snap(e.rawWorld);
      if (dist(at, vertex) < 2 / ctx.viewport.scale) {
        ctx.setStatus('ANGLE: too close to vertex');
        return;
      }
      this.p1 = at;
      const dirA = normalizeVec(sub(at, vertex));
      this.dirA = dirA;
      ctx.setStatus('ANGLE: pick a point on the 2nd side');
      ctx.draw();
      return;
    }
    const dirA = this.dirA as Vec;
    const at = ctx.snap(e.rawWorld);
    if (dist(at, vertex) < 2 / ctx.viewport.scale) {
      ctx.setStatus('ANGLE: too close to vertex');
      return;
    }
    const dirB = normalizeVec(sub(at, vertex));
    const degrees = Math.round(radToDeg(angleBetweenDirs(dirA, dirB)));
    const newId = ctx.idgen.next();
    const defaultText = `${degrees}°`;
    const right = isRightLabel(defaultText);
    const created: AngleLabelShape = {
      id: newId,
      type: 'angleLabel',
      vertex,
      dirA,
      dirB,
      text: right ? '' : defaultText,
      right,
      style: { ...DEFAULT_STYLE },
    };
    this.reset();
    ctx.add(created);
    ctx.setStatus(right ? 'ANGLE: 90° (right)' : `ANGLE: ${defaultText}`);
    // The prompt is prefilled with the bare number; the user never types `°`.
    // The right-angle square follows the typed value: typing 90 -> square with
    // no number, typing anything else (e.g. 45) -> that arc with its label.
    const edited = await ctx.promptText('angle label:', String(degrees));
    if (edited !== null) {
      const value = edited.trim();
      const finalText = value === '' ? defaultText : ensureDegree(value);
      const finalRight = isRightLabel(finalText);
      if (finalText !== created.text || finalRight !== right) {
        const current = ctx.scene.shapes[newId];
        if (current && current.type === 'angleLabel') {
          ctx.replace(new Map([[newId, current]]), new Map([[newId, { ...current, text: finalRight ? '' : finalText, right: finalRight }]]));
        }
      }
    }
  }

  cancel(ctx: EditorContext): void {
    this.reset();
    ctx.setStatus('CANCEL');
    ctx.draw();
  }

  drawOverlay(o: Overlay): void {
    if (this.vertex) o.drawAnchor(this.vertex, true);
    const scale = o.scale;
    const vertex = this.vertex;
    const dirA = this.dirA;
    const cursor = this.mouse;
    if (vertex && dirA && cursor) {
      const dirB = normalizeVec(sub(cursor, vertex));
      const degrees = Math.round(radToDeg(angleBetweenDirs(dirA, dirB)));
      const r = ARC_R / scale;
      const angA = Math.atan2(dirA.y, dirA.x);
      const angB = Math.atan2(dirB.y, dirB.x);
      const sweep = normalizeAngle(angB - angA);
      o.drawDashedSegment(vertex, { x: vertex.x + r * Math.cos(angA), y: vertex.y + r * Math.sin(angA) });
      o.drawDashedSegment(vertex, { x: vertex.x + r * Math.cos(angB), y: vertex.y + r * Math.sin(angB) });
      o.drawDashedArc(vertex, r, angA, angA + sweep);
      const mid = angA + sweep / 2;
      const labelR = r + 16 / scale;
      o.drawText(`${degrees}°`, { x: vertex.x + labelR * Math.cos(mid), y: vertex.y + labelR * Math.sin(mid) });
    } else if (vertex && cursor) {
      o.drawDashedSegment(vertex, cursor);
    }
  }
}
