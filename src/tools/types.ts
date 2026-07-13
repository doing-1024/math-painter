import type { Vec, Shape, Scene } from '../core/types';
import type { Selection } from '../app/selection';
import type { Viewport } from '../app/viewport';
import type { CommandStack } from '../core/commands';
import type { IdGenerator } from '../core/ids';
import type { Overlay } from '../render/renderer';

export interface PointerInput {
  client: Vec;
  rawWorld: Vec;
  button: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface EditorContext {
  readonly scene: Scene;
  readonly selection: Selection;
  readonly viewport: Viewport;
  readonly commands: CommandStack;
  readonly idgen: IdGenerator;
  lastSnap: Vec | null;
  add(shape: Shape): void;
  replace(before: Map<string, Shape>, after: Map<string, Shape>): void;
  deleteShapes(ids: string[]): void;
  /** Pick a point with snapping (see `pickPoint` in core/snap): anchor snapping
   *  takes priority, then edge snapping; `extra` adds transient anchors such as
   *  in-progress preview vertices, and `exclude` skips the given shape ids (used
   *  while dragging a selection so a shape cannot snap to itself). Updates
   *  `lastSnap` for the on-canvas indicator. Every tool must route its point
   *  picks through this. */
  snap(world: Vec, extra?: Vec[], exclude?: string[]): Vec;
  draw(): void;
  setStatus(message: string): void;
  /** Update the status line text without forcing a redraw (use per-frame). */
  setStatusText(message: string): void;
  /** Show a transient text input and resolve with the entered value (or null
   *  when cancelled). Used by tools that need a label/value from the user. */
  promptText(message: string, defaultValue?: string): Promise<string | null>;
  /** Show a small choice menu and resolve with the chosen option key (or null
   *  on cancel). Used by the polygon tool (regular vs free) and to pick what
   *  to measure on a circle (area / circumference / diameter / radius). */
  promptChoice(title: string, options: { key: string; label: string }[]): Promise<string | null>;
}

export interface Tool {
  id: string;
  /** Short toolbar/legend label (e.g. the tool's key). Plugin tools set this
   *  so the toolbar does not fall back to the first letter of the id (which
   *  would collide with built-in tools, e.g. "arrow" -> "A" == arc). */
  label?: string;
  cursor?: string;
  activate?(ctx: EditorContext): void;
  deactivate?(ctx: EditorContext): void;
  pointerDown(ctx: EditorContext, e: PointerInput): void;
  pointerMove?(ctx: EditorContext, e: PointerInput): void;
  pointerUp?(ctx: EditorContext, e: PointerInput): void;
  pointerCancel?(ctx: EditorContext): void;
  dblClick?(ctx: EditorContext, e: PointerInput): void;
  cancel?(ctx: EditorContext): void;
  drawOverlay?(overlay: Overlay): void;
}
