import type { Shape, Scene } from './types';
import { cloneShape } from './util';

export interface Command {
  do(): void;
  undo(): void;
}

export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(private readonly onChange?: () => void) {}

  push(command: Command): void {
    command.do();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.onChange?.();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.onChange?.();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.do();
    this.undoStack.push(command);
    this.onChange?.();
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

export function addShapeCommand(scene: Scene, shape: Shape): Command {
  return {
    do() {
      scene.shapes[shape.id] = shape;
      if (!scene.order.includes(shape.id)) scene.order.push(shape.id);
    },
    undo() {
      delete scene.shapes[shape.id];
      scene.order = scene.order.filter((id) => id !== shape.id);
    },
  };
}

export function replaceShapesCommand(
  scene: Scene,
  before: Map<string, Shape>,
  after: Map<string, Shape>,
): Command {
  return {
    do() {
      for (const [id, shape] of after) scene.shapes[id] = cloneShape(shape);
    },
    undo() {
      for (const [id, shape] of before) scene.shapes[id] = cloneShape(shape);
    },
  };
}

export function deleteShapesCommand(scene: Scene, shapes: Shape[], order: string[]): Command {
  return {
    do() {
      for (const shape of shapes) delete scene.shapes[shape.id];
      scene.order = scene.order.filter((id) => !shapes.some((shape) => shape.id === id));
    },
    undo() {
      for (const shape of shapes) scene.shapes[shape.id] = cloneShape(shape);
      scene.order = order;
    },
  };
}
