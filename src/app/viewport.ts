import type { Vec } from '../core/types';

export class Viewport {
  x = 0;
  y = 0;
  scale = 1;

  toWorld(clientX: number, clientY: number, rect: DOMRect): Vec {
    return {
      x: (clientX - rect.left - this.x) / this.scale,
      y: (clientY - rect.top - this.y) / this.scale,
    };
  }

  zoomAt(mouse: Vec, factor: number): void {
    const worldX = (mouse.x - this.x) / this.scale;
    const worldY = (mouse.y - this.y) / this.scale;
    this.scale = Math.max(0.1, Math.min(12, this.scale * factor));
    this.x = mouse.x - worldX * this.scale;
    this.y = mouse.y - worldY * this.scale;
  }

  /** World -> screen pixels (relative to the canvas origin). Used by the HTML
   *  label layer, which overlays the canvas in screen space. */
  toScreen(world: Vec): Vec {
    return { x: world.x * this.scale + this.x, y: world.y * this.scale + this.y };
  }
}
