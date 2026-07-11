import type { Shape, Vec } from '../core/types';
import { anchorsOf, getShapeDefinition } from '../core/shapes/registry';
import type { Viewport } from '../app/viewport';

export interface Overlay {
  ctx: CanvasRenderingContext2D;
  scale: number;
  drawAnchor(point: Vec, active: boolean): void;
  drawSnap(point: Vec): void;
  drawDashedSegment(a: Vec, b: Vec): void;
  drawDashedCircle(c: Vec, r: number): void;
  drawDashedArc(c: Vec, r: number, a0: number, a1: number): void;
  drawDashedPolygon(points: Vec[]): void;
  drawPoint(point: Vec, color?: string): void;
  drawText(text: string, at: Vec, color?: string): void;
}

export class CanvasRenderer implements Overlay {
  ctx: CanvasRenderingContext2D;
  scale = 1;
  private rect: DOMRect;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2d canvas unavailable');
    this.ctx = context;
    this.rect = canvas.getBoundingClientRect();
  }

  /** Re-read the canvas client size and (only if changed) realloc the
   *  backing store. Calling this on every frame is cheap because it does
   *  NOT reallocate the canvas unless the size actually changed. */
  measure(): void {
    this.rect = this.canvas.getBoundingClientRect();
    this.syncSize();
  }

  private syncSize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(this.rect.width * dpr));
    const h = Math.max(1, Math.floor(this.rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  resize(): DOMRect {
    this.syncSize();
    return this.rect;
  }

  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#020402';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawGrid(rect: DOMRect, viewport: Viewport): void {
    const step = 40 * viewport.scale;
    if (step < 8) return;
    this.ctx.strokeStyle = '#102014';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    const ox = viewport.x % step;
    const oy = viewport.y % step;
    for (let x = ox; x < rect.width; x += step) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, rect.height);
    }
    for (let y = oy; y < rect.height; y += step) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(rect.width, y);
    }
    this.ctx.stroke();
  }

  beginWorld(viewport: Viewport): void {
    this.scale = viewport.scale;
    this.ctx.save();
    this.ctx.translate(viewport.x, viewport.y);
    this.ctx.scale(viewport.scale, viewport.scale);
  }

  endWorld(): void {
    this.ctx.restore();
  }

  drawShape(shape: Shape, active: boolean): void {
    const definition = getShapeDefinition(shape.type);
    if (!definition) return;
    this.ctx.save();
    if (shape.hidden) this.ctx.globalAlpha = 0.22;
    definition.draw(this.ctx, shape, { scale: this.scale, active });
    for (const anchor of anchorsOf(shape)) this.drawAnchor(anchor, active);
    this.ctx.restore();
  }

  drawAnchor(point: Vec, active: boolean): void {
    const size = (active ? 7 : 6) / this.scale;
    this.ctx.fillStyle = active ? '#ffffff' : '#020402';
    this.ctx.strokeStyle = active ? '#ffffff' : '#8cff8c';
    this.ctx.lineWidth = 1.5 / this.scale;
    this.ctx.beginPath();
    this.ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawSnap(point: Vec): void {
    const size = 12 / this.scale;
    this.ctx.strokeStyle = '#ffff8c';
    this.ctx.lineWidth = 1.5 / this.scale;
    this.ctx.beginPath();
    this.ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
    this.ctx.moveTo(point.x - size, point.y);
    this.ctx.lineTo(point.x + size, point.y);
    this.ctx.moveTo(point.x, point.y - size);
    this.ctx.lineTo(point.x, point.y + size);
    this.ctx.stroke();
  }

  private dashed(fn: () => void): void {
    const scale = this.scale;
    this.ctx.save();
    this.ctx.strokeStyle = '#ffff8c';
    this.ctx.lineWidth = 1 / scale;
    this.ctx.setLineDash([6 / scale, 6 / scale]);
    fn();
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  drawDashedSegment(a: Vec, b: Vec): void {
    this.dashed(() => {
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    });
  }

  drawDashedCircle(c: Vec, r: number): void {
    this.dashed(() => {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      this.ctx.stroke();
    });
  }

  drawDashedArc(c: Vec, r: number, a0: number, a1: number): void {
    this.dashed(() => {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, r, a0, a1);
      this.ctx.stroke();
    });
  }

  drawDashedPolygon(points: Vec[]): void {
    if (points.length < 2) return;
    this.dashed(() => {
      this.ctx.beginPath();
      points.forEach((point, index) => (index ? this.ctx.lineTo(point.x, point.y) : this.ctx.moveTo(point.x, point.y)));
      this.ctx.stroke();
    });
  }

  drawPoint(point: Vec, color = '#ffff8c'): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, 3 / this.scale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawText(text: string, at: Vec, color = '#ffff8c'): void {
    const size = 13 / this.scale;
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, at.x, at.y);
    this.ctx.restore();
  }
}
