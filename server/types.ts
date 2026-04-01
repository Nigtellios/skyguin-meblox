export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  grid_size_mm: number;
  grid_visible: number;
  thumbnail: string | null;
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
  material_type: string;
  edge_banding_json: string | null;
  material_template_id: string | null;
  component_id: string | null;
  is_independent: number;
  created_at: number;
  updated_at: number;
};

export type RelationType = "dimension" | "attachment";
export type RelationField =
  | "width"
  | "height"
  | "depth"
  | "position_x"
  | "position_y"
  | "position_z";
export type RelationMode = "direct" | "relative" | "anchor";
export type RelationAnchor = "start" | "center" | "end";

export type ObjectRelationRow = {
  id: string;
  project_id: string;
  source_object_id: string;
  target_object_id: string;
  relation_type: RelationType;
  source_field: RelationField;
  target_field: RelationField;
  mode: RelationMode;
  source_anchor: RelationAnchor | null;
  target_anchor: RelationAnchor | null;
  offset_mm: number;
  created_at: number;
};

export type MaterialTemplateWithLayers = MaterialTemplateRow & {
  layers: MaterialLayerRow[];
};

export type ProjectPayload = Partial<
  Pick<
    ProjectRow,
    "name" | "description" | "grid_size_mm" | "grid_visible" | "thumbnail"
  >
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
    | "material_type"
    | "edge_banding_json"
    | "material_template_id"
    | "component_id"
    | "is_independent"
  >
>;

export type ObjectRelationPayload = Partial<
  Pick<
    ObjectRelationRow,
    | "source_object_id"
    | "target_object_id"
    | "relation_type"
    | "source_field"
    | "target_field"
    | "mode"
    | "source_anchor"
    | "target_anchor"
    | "offset_mm"
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

export type HistoryRow = {
  id: string;
  project_id: string;
  action_type: string;
  action_label: string;
  snapshot: string;
  created_at: number;
};

export type HistoryRevertPayload = {
  history_id: string;
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
