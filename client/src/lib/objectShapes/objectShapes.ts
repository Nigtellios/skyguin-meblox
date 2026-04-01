export type ObjectShape = "box" | "sphere" | "cylinder" | "cube";

export const OBJECT_SHAPES: readonly ObjectShape[] = [
  "box",
  "sphere",
  "cylinder",
  "cube",
] as const;

export const OBJECT_SHAPE_LABELS: Record<ObjectShape, string> = {
  box: "Prostopadłościan",
  sphere: "Kula",
  cylinder: "Cylinder",
  cube: "Sześcian",
};

/**
 * Edge rounding configuration for box-like objects.
 * Promień zaoblenia (fillet radius) applied to selected edges.
 * Based on carpentry standards:
 * - Common fillet radii: 3mm, 5mm, 10mm, 15mm, 20mm, 25mm, 30mm
 * - Always cut perpendicular - the rounding arc maintains the object's thickness
 * - Applied by replacing sharp corners with cylindrical arcs
 */
export type EdgeRoundingConfig = {
  /** Which edges to round. For box objects, defined by corners */
  topLeft: number; // radius in mm, 0 = no rounding
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};

export const DEFAULT_EDGE_ROUNDING: EdgeRoundingConfig = {
  topLeft: 0,
  topRight: 0,
  bottomLeft: 0,
  bottomRight: 0,
};

export const EDGE_ROUNDING_PRESETS = [0, 3, 5, 10, 15, 20, 25, 30, 50];
