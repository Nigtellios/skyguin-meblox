import { z } from "zod";

// ---- Zod Schemas ----

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  grid_size_mm: z.number().default(100),
  grid_visible: z.number().default(1),
  created_at: z.number(),
  updated_at: z.number(),
});

export const FurnitureObjectSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  depth: z.number(),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
  position_z: z.number().default(0),
  rotation_y: z.number().default(0),
  color: z.string().default("#8B7355"),
  material_template_id: z.string().nullable().default(null),
  component_id: z.string().nullable().default(null),
  is_independent: z.number().default(0),
  created_at: z.number(),
  updated_at: z.number(),
});

export const MaterialLayerSchema = z.object({
  id: z.string(),
  template_id: z.string(),
  side: z.enum(["top", "bottom", "left", "right", "front", "back"]),
  layer_type: z.string(),
  color: z.string(),
  thickness: z.number(),
  is_bilateral: z.number(),
  opposite_side: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.number(),
});

export const MaterialTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  base_color: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  layers: z.array(MaterialLayerSchema).default([]),
});

export const ComponentGroupSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  created_at: z.number(),
});

// ---- TypeScript Types (inferred from Zod) ----
export type Project = z.infer<typeof ProjectSchema>;
export type FurnitureObject = z.infer<typeof FurnitureObjectSchema>;
export type MaterialLayer = z.infer<typeof MaterialLayerSchema>;
export type MaterialTemplate = z.infer<typeof MaterialTemplateSchema>;
export type ComponentGroup = z.infer<typeof ComponentGroupSchema>;

export type Side = "top" | "bottom" | "left" | "right" | "front" | "back";
export type LayerType =
  | "veneer"
  | "edge_banding"
  | "paint"
  | "laminate"
  | "foil";

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  veneer: "Fornir",
  edge_banding: "Obrzeże",
  paint: "Lakier",
  laminate: "Laminat",
  foil: "Folia",
};

export const SIDE_LABELS: Record<Side, string> = {
  top: "Góra",
  bottom: "Dół",
  left: "Lewo",
  right: "Prawo",
  front: "Przód",
  back: "Tył",
};

export const OPPOSITE_SIDES: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
  front: "back",
  back: "front",
};

// Grid configuration
export type GridConfig = {
  visible: boolean;
  sizeX: number; // mm per cell on X
  sizeY: number; // mm per cell on Y
  sizeZ: number; // mm per cell on Z
  unit: "mm" | "cm";
};

// Scene state
export type SceneMode = "select" | "move" | "rotate";

export type AppPanel =
  | "none"
  | "objects"
  | "materials"
  | "grid"
  | "components"
  | "object-props";
