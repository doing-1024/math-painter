import { describe, it, expect } from 'vitest';
import './../core/shapes';
import { SelectTool } from './select';
import { Selection } from '../app/selection';
import { Viewport } from '../app/viewport';
import { IdGenerator } from '../core/ids';
import { CommandStack } from '../core/commands';
import type { EditorContext, PointerInput } from './types';
import type { Scene, Shape } from '../core/types';

const style = { stroke: '#0f0', fill: '#000', width: 1 };

function makeScene(): Scene {
  const shapes: Record<string, Shape> = {
    seg: { id: 'seg', type: 'segment', a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, style },
  };
  return { shapes, order: ['seg'] };
}

function makeCtx(scene: Scene): EditorContext {
  const selection = new Selection();
  return {
    scene,
    selection,
    viewport: new Viewport(),
    commands: new CommandStack(),
    idgen: new IdGenerator(),
    add: () => {},
    replace: () => {},
    deleteShapes: () => {},
    snap: (w: { x: number; y: number }) => w,
    draw: () => {},
    setStatus: () => {},
    setStatusText: () => {},
    promptText: async () => null,
    promptChoice: async () => null,
  } as unknown as EditorContext;
}

function click(rawWorld: { x: number; y: number }, ctrl = false): PointerInput {
  return { client: rawWorld, rawWorld, button: 0, shift: false, alt: false, ctrl };
}

describe('SelectTool', () => {
  it('selects a shape on plain click', () => {
    const tool = new SelectTool();
    const ctx = makeCtx(makeScene());
    tool.pointerDown(ctx, click({ x: 0, y: 0 }));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual(['seg']);
  });

  it('ctrl+click toggles a shape out of the selection', () => {
    const tool = new SelectTool();
    const ctx = makeCtx(makeScene());
    tool.pointerDown(ctx, click({ x: 0, y: 0 }));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual(['seg']);
    tool.pointerDown(ctx, click({ x: 0, y: 0 }, true));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual([]);
  });

  it('ctrl+click on an unselected shape adds it', () => {
    const tool = new SelectTool();
    const ctx = makeCtx(makeScene());
    tool.pointerDown(ctx, click({ x: 0, y: 0 }, true));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual(['seg']);
  });

  it('rubber-band selection picks up the enclosed shape', () => {
    const tool = new SelectTool();
    const ctx = makeCtx(makeScene());
    tool.pointerDown(ctx, click({ x: -5, y: -5 }));
    tool.pointerMove?.(ctx, click({ x: 5, y: 5 }));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual(['seg']);
  });

  it('a plain click on empty canvas clears the selection', () => {
    const tool = new SelectTool();
    const ctx = makeCtx(makeScene());
    tool.pointerDown(ctx, click({ x: 0, y: 0 }));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual(['seg']);
    tool.pointerDown(ctx, click({ x: 1000, y: 1000 }));
    tool.pointerUp(ctx);
    expect(ctx.selection.list()).toEqual([]);
  });
});
