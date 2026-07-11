import type { Scene } from './types';

export class IdGenerator {
  private seq = 1;

  next(prefix = 's'): string {
    return `${prefix}${this.seq++}`;
  }

  advance(scene: Scene): void {
    let max = 0;
    for (const id of Object.keys(scene.shapes)) {
      const match = /^s(\d+)$/.exec(id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    this.seq = Math.max(this.seq, max + 1);
  }
}
