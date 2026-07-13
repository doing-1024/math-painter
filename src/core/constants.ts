/**
 * Shared screen-space constants (in CSS pixels, before the viewport scale is
 * applied). Centralised here so that the on-canvas renderer, the SVG exporter,
 * hit-testing, and every shape definition read the *same* values — no more
 * duplicated magic numbers scattered across modules.
 */

/** Hit-test tolerance in screen pixels (used by hitTest / hit). */
export const HIT_TOLERANCE_PX = 8;
/** Anchor snapping radius in screen pixels (pickPoint anchor phase). */
export const ANCHOR_SNAP_PX = 10;
/** Edge snapping radius in screen pixels (pickPoint edge phase). */
export const EDGE_SNAP_PX = 14;
/** Radius of the angle arc in screen pixels. */
export const ANGLE_ARC_RADIUS_PX = 26;
/** Side length of the right-angle square in screen pixels. */
export const RIGHT_SQUARE_PX = 16;
/** Length of one tick mark in screen pixels. */
export const TICK_LEN_PX = 10;
/** Gap between multiple tick marks in screen pixels. */
export const TICK_GAP_PX = 5;
/** Glyph font size in screen pixels (labels, angle text, point labels). */
export const GLYPH_FONT_PX = 13;
/** Radius of a rendered point dot in screen pixels. */
export const POINT_RADIUS_PX = 4;
/** Number of samples used to approximate an arc curve. */
export const ARC_SAMPLES = 24;
/** Maximum number of tick marks per edge. */
export const MAX_TICK = 8;

/** On-canvas colour for drawn shapes (white). */
export const SHAPE_INK = '#ffffff';
/** Colour used to highlight the current selection (geek green). */
export const SHAPE_SELECT = '#0f0';
