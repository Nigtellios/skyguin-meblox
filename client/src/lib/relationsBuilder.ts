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
export const BUILDER_LAYOUT_PADDING = 48;
export const BUILDER_LAYOUT_COLUMNS = 3;
export const BUILDER_BOUNDARY_HEIGHT = 860;
export const RELATION_LABEL_CHAR_WIDTH_ESTIMATE = 7.2;

export function estimateRelationLabelWidth(text: string, minWidthPx: number) {
  return Math.max(minWidthPx, text.length * RELATION_LABEL_CHAR_WIDTH_ESTIMATE);
}

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
        x:
          BUILDER_LAYOUT_PADDING +
          (index % BUILDER_LAYOUT_COLUMNS) * BUILDER_NODE_GAP_X,
        y:
          BUILDER_LAYOUT_PADDING +
          Math.floor(index / BUILDER_LAYOUT_COLUMNS) * BUILDER_NODE_GAP_Y,
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

function getBuilderControlPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const controlOffset = Math.max(80, Math.abs(dx) / 2);
  // For backward connections (source right of target), flip control point directions
  // to avoid looping bezier curves
  return {
    cp1: {
      x: dx >= 0 ? start.x + controlOffset : start.x - controlOffset,
      y: start.y,
    },
    cp2: {
      x: dx >= 0 ? end.x - controlOffset : end.x + controlOffset,
      y: end.y,
    },
  };
}

export function createBuilderEdgePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const { cp1, cp2 } = getBuilderControlPoints(start, end);
  return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
}

export function createBuilderEdgePaths(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { firstHalf: string; secondHalf: string } {
  const { cp1, cp2 } = getBuilderControlPoints(start, end);

  // De Casteljau split at t=0.5 – places the arrowhead at the visual midpoint
  const q0 = { x: (start.x + cp1.x) / 2, y: (start.y + cp1.y) / 2 };
  const q1 = { x: (cp1.x + cp2.x) / 2, y: (cp1.y + cp2.y) / 2 };
  const q2 = { x: (cp2.x + end.x) / 2, y: (cp2.y + end.y) / 2 };
  const r0 = { x: (q0.x + q1.x) / 2, y: (q0.y + q1.y) / 2 };
  const r1 = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 };
  const mid = { x: (r0.x + r1.x) / 2, y: (r0.y + r1.y) / 2 };

  return {
    firstHalf: `M ${start.x} ${start.y} C ${q0.x} ${q0.y}, ${r0.x} ${r0.y}, ${mid.x} ${mid.y}`,
    secondHalf: `M ${mid.x} ${mid.y} C ${r1.x} ${r1.y}, ${q2.x} ${q2.y}, ${end.x} ${end.y}`,
  };
}
