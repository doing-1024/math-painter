export type Vec = { x: number; y: number };

export type Style = {
  stroke: string;
  fill: string;
  width: number;
};

export type ShapeType = 'point' | 'segment' | 'circle' | 'polygon' | 'arc' | 'angleLabel' | 'tick' | 'label';

export interface BaseShape {
  id: string;
  type: ShapeType;
  style: Style;
  /** When true the shape is dimmed on screen and omitted from SVG export
   *  (used to hide construction lines in the final figure). */
  hidden?: boolean;
}

export interface PointShape extends BaseShape {
  type: 'point';
  p: Vec;
  label?: string;
}

export interface SegmentShape extends BaseShape {
  type: 'segment';
  a: Vec;
  b: Vec;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  c: Vec;
  r: number;
}

export interface PolygonShape extends BaseShape {
  type: 'polygon';
  points: Vec[];
}

export interface ArcShape extends BaseShape {
  type: 'arc';
  c: Vec;
  r: number;
  a0: number;
  a1: number;
}

export interface AngleLabelShape extends BaseShape {
  type: 'angleLabel';
  /** Optional back-references to the sides this angle was measured from; used
   *  only for cascade deletion. Three-point angles leave these unset. */
  aId?: string;
  bId?: string;
  vertex: Vec;
  dirA: Vec;
  dirB: Vec;
  text: string;
  /** When true the angle is drawn as a right-angle square instead of an arc
   *  (auto-set when the angle is ~90deg, or when the label reads 90). */
  right?: boolean;
}

export interface TickShape extends BaseShape {
  type: 'tick';
  a: Vec;
  b: Vec;
  count: number;
}

export interface LabelShape extends BaseShape {
  type: 'label';
  /** Free text placed by the author (no measurement is computed). */
  text: string;
  at: Vec;
}

export type Shape =
  | PointShape
  | SegmentShape
  | CircleShape
  | PolygonShape
  | ArcShape
  | AngleLabelShape
  | TickShape
  | LabelShape;

export interface Scene {
  shapes: Record<string, Shape>;
  order: string[];
}
