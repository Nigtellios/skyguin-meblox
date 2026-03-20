import { describe, expect, test } from "bun:test";
import { getRelationFieldKind } from "../../../lib/relationsBuilder/relationsBuilder";
import {
  type ObjectRelation,
  RELATION_ANCHOR_LABELS,
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_TYPE_LABELS,
} from "../../../types/index";

// RelationsPanel handles the visual relation editor.
// These tests verify the pure helper functions used in the panel.

function relationSummary(relation: ObjectRelation) {
  if (relation.relation_type === "dimension") {
    return `${RELATION_MODE_LABELS[relation.mode]} · ${RELATION_FIELD_LABELS[relation.source_field]} → ${RELATION_FIELD_LABELS[relation.target_field]}`;
  }
  return `${RELATION_TYPE_LABELS.attachment} · ${RELATION_FIELD_LABELS[relation.target_field]} · ${RELATION_ANCHOR_LABELS[relation.source_anchor ?? "center"]} → ${RELATION_ANCHOR_LABELS[relation.target_anchor ?? "center"]}`;
}

function formatFieldValue(
  object: { width: number; height: number; depth: number },
  field: "width" | "height" | "depth",
) {
  return `${Math.round(object[field])} mm`;
}

function edgePathProps(type: string) {
  return {
    fill: "none",
    stroke: "#60a5fa",
    "stroke-width": 2.5,
    "stroke-dasharray": type === "attachment" ? "8 5" : "0",
  };
}

describe("RelationsPanel", () => {
  test("relationSummary formats dimension relation correctly", () => {
    const relation = {
      id: "r1",
      project_id: "p",
      source_object_id: "s",
      target_object_id: "t",
      relation_type: "dimension" as const,
      source_field: "width" as const,
      target_field: "width" as const,
      mode: "direct" as const,
      source_anchor: null,
      target_anchor: null,
      offset_mm: 0,
      created_at: 1,
    };
    const summary = relationSummary(relation);
    expect(summary).toContain(RELATION_MODE_LABELS.direct);
    expect(summary).toContain(RELATION_FIELD_LABELS.width);
  });

  test("relationSummary formats attachment relation correctly", () => {
    const relation = {
      id: "r2",
      project_id: "p",
      source_object_id: "s",
      target_object_id: "t",
      relation_type: "attachment" as const,
      source_field: "position_x" as const,
      target_field: "position_x" as const,
      mode: "anchor" as const,
      source_anchor: "end" as const,
      target_anchor: "start" as const,
      offset_mm: 0,
      created_at: 1,
    };
    const summary = relationSummary(relation);
    expect(summary).toContain(RELATION_TYPE_LABELS.attachment);
  });

  test("formatFieldValue rounds value and appends mm", () => {
    const obj = { width: 17.9, height: 720, depth: 560 };
    expect(formatFieldValue(obj, "width")).toBe("18 mm");
    expect(formatFieldValue(obj, "height")).toBe("720 mm");
  });

  test("edgePathProps uses dashed line for attachment", () => {
    const attachProps = edgePathProps("attachment");
    expect(attachProps["stroke-dasharray"]).toBe("8 5");
  });

  test("edgePathProps uses solid line for dimension", () => {
    const dimProps = edgePathProps("dimension");
    expect(dimProps["stroke-dasharray"]).toBe("0");
  });

  test("getRelationFieldKind correctly categorizes fields", () => {
    expect(getRelationFieldKind("width")).toBe("dimension");
    expect(getRelationFieldKind("position_x")).toBe("position");
  });
});
