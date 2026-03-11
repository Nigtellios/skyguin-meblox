export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  grid_size_mm: number;
  grid_visible: number;
  created_at: number;
  updated_at: number;
};

export type ComponentGroupRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
};

export type MaterialTemplateRow = {
  id: string;
  name: string;
  description: string;
  base_color: string;
  created_at: number;
  updated_at: number;
};

export type MaterialLayerRow = {
  id: string;
  template_id: string;
  side: string;
  layer_type: string;
  color: string;
  thickness: number;
  is_bilateral: number;
  opposite_side: string | null;
  sort_order: number;
  created_at: number;
};

export type FurnitureObjectRow = {
  id: string;
  project_id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  position_x: number;
  position_y: number;
  position_z: number;
  rotation_y: number;
  color: string;
  material_template_id: string | null;
  component_id: string | null;
  is_independent: number;
  created_at: number;
  updated_at: number;
};

export type MaterialTemplateWithLayers = MaterialTemplateRow & {
  layers: MaterialLayerRow[];
};

export type ProjectPayload = Partial<
  Pick<ProjectRow, "name" | "description" | "grid_size_mm" | "grid_visible">
>;

export type FurnitureObjectPayload = Partial<
  Pick<
    FurnitureObjectRow,
    | "name"
    | "width"
    | "height"
    | "depth"
    | "position_x"
    | "position_y"
    | "position_z"
    | "rotation_y"
    | "color"
    | "material_template_id"
    | "component_id"
    | "is_independent"
  >
>;

export type DuplicatePayload = {
  offset_x?: number;
  offset_z?: number;
};

export type ComponentPayload = {
  name?: string;
  object_ids?: string[];
};

export type MaterialTemplatePayload = Partial<
  Pick<MaterialTemplateRow, "name" | "description" | "base_color">
>;

export type MaterialLayerPayload = Partial<
  Pick<
    MaterialLayerRow,
    "side" | "layer_type" | "color" | "thickness" | "sort_order"
  >
> & {
  is_bilateral?: boolean;
};

export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
) => Response | Promise<Response>;

export type Route = {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
};
