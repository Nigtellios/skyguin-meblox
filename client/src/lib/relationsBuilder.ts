import type { FurnitureObject, ObjectRelation } from "../types";

export type BuilderField = ObjectRelation["source_field"];
export type BuilderNodeLayout = {
  id: string;
  x: number;
  y: number;
};

export const BUILDER_NODE_WIDTH = 280;
export const BUILDER_NODE_HEADER_HEIGHT = 44;
export const BUILDER_NODE_ROW_HEIGHT = 34;
export const BUILDER_NODE_GAP_X = 340;
export const BUILDER_NODE_GAP_Y = 240;

export function getRelationFieldKind(field: BuilderField) {
  if (field === "width" || field === "height" || field === "depth") {
    return "dimension" as const;
  }
  return "position" as const;
}

export function canConnectFields(
  sourceField: BuilderField,
  targetField: BuilderField,
  mode: "visual" | "attach",
) {
  const sourceKind = getRelationFieldKind(sourceField);
  const targetKind = getRelationFieldKind(targetField);

  if (mode === "visual") {
    return sourceKind === "dimension" && targetKind === "dimension";
  }

  return sourceKind === "position" && targetKind === "position";
}

export function createBuilderLayout(
  objects: readonly FurnitureObject[],
  existing: Readonly<Record<string, BuilderNodeLayout>> = {},
) {
  return objects.reduce<Record<string, BuilderNodeLayout>>(
    (layout, object, index) => {
      layout[object.id] = existing[object.id] ?? {
        id: object.id,
        x: 48 + (index % 3) * BUILDER_NODE_GAP_X,
        y: 48 + Math.floor(index / 3) * BUILDER_NODE_GAP_Y,
      };
      return layout;
    },
    {},
  );
}

export function getFieldAnchorPoint(
  node: BuilderNodeLayout,
  fieldIndex: number,
  side: "left" | "right",
) {
  return {
    x: node.x + (side === "left" ? 0 : BUILDER_NODE_WIDTH),
    y:
      node.y +
      BUILDER_NODE_HEADER_HEIGHT +
      fieldIndex * BUILDER_NODE_ROW_HEIGHT +
      BUILDER_NODE_ROW_HEIGHT / 2,
  };
}

export function createBuilderEdgePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const controlOffset = Math.max(80, Math.abs(end.x - start.x) / 2);
  return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;
}
