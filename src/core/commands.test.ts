import { describe, it, expect } from 'vitest';
import { CommandStack, addShapeCommand, replaceShapesCommand, deleteShapesCommand } from './commands';
import type { Scene, PointShape } from './types';

function emptyScene(): Scene {
  return { shapes: {}, order: [] };
}

function point(id: string, x: number, y: number): PointShape {
  return { id, type: 'point', p: { x, y }, style: { stroke: '#0f0', fill: '#000', width: 1 } };
}

describe('commands', () => {
  it('add pushes and undo removes', () => {
    const scene = emptyScene();
    const stack = new CommandStack();
    stack.push(addShapeCommand(scene, point('s1', 0, 0)));
    expect(scene.order).toEqual(['s1']);
    stack.undo();
    expect(scene.order).toEqual([]);
    expect(scene.shapes.s1).toBeUndefined();
  });

  it('redo re-applies after undo', () => {
    const scene = emptyScene();
    const stack = new CommandStack();
    stack.push(addShapeCommand(scene, point('s1', 0, 0)));
    stack.undo();
    stack.redo();
    expect(scene.order).toEqual(['s1']);
  });

  it('replace swaps geometry and restores on undo', () => {
    const scene = emptyScene();
    scene.shapes.s1 = point('s1', 0, 0);
    scene.order = ['s1'];
    const stack = new CommandStack();
    const before = new Map([['s1', scene.shapes.s1]]);
    const after = new Map([['s1', point('s1', 5, 5)]]);
    stack.push(replaceShapesCommand(scene, before, after));
    expect(scene.shapes.s1.p).toEqual({ x: 5, y: 5 });
    stack.undo();
    expect(scene.shapes.s1.p).toEqual({ x: 0, y: 0 });
  });

  it('delete removes and undo restores order', () => {
    const scene = emptyScene();
    scene.shapes.s1 = point('s1', 0, 0);
    scene.shapes.s2 = point('s2', 1, 1);
    scene.order = ['s1', 's2'];
    const stack = new CommandStack();
    stack.push(deleteShapesCommand(scene, [scene.shapes.s1], [...scene.order]));
    expect(scene.order).toEqual(['s2']);
    stack.undo();
    expect(scene.order).toEqual(['s1', 's2']);
  });

  it('new command clears redo stack', () => {
    const scene = emptyScene();
    const stack = new CommandStack();
    stack.push(addShapeCommand(scene, point('s1', 0, 0)));
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.push(addShapeCommand(scene, point('s2', 1, 1)));
    expect(stack.canRedo).toBe(false);
  });
});
