import { describe, expect, test } from "bun:test";
import {
  displayGridValue,
  GRID_PRESETS,
  normalizeGridInput,
} from "../client/src/lib/grid";
import {
  OBJECT_COLOR_PALETTE,
  OBJECT_PRESETS,
} from "../client/src/lib/objectPresets";
import {
  FurnitureObjectSchema,
  MaterialTemplateSchema,
  ObjectRelationSchema,
  OPPOSITE_SIDES,
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_TYPE_LABELS,
  SIDE_LABELS,
} from "../client/src/types";

describe("client helpers", () => {
  test("grid helpers convert values between mm and cm", () => {
    expect(displayGridValue(100, "mm")).toBe(100);
    expect(displayGridValue(100, "cm")).toBe(10);
    expect(normalizeGridInput(15, "mm")).toBe(15);
    expect(normalizeGridInput(15, "cm")).toBe(150);
  });

  test("object presets stay available for quick furniture creation", () => {
    expect(OBJECT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(OBJECT_PRESETS[0]).toMatchObject({
      name: "Bok korpusu",
      width: 18,
      depth: 600,
    });
    expect(OBJECT_COLOR_PALETTE).toContain("#8B7355");
    expect(GRID_PRESETS.map((preset) => preset.label)).toContain("100mm");
  });

  test("type schemas parse current furniture records", () => {
    const furnitureObject = FurnitureObjectSchema.parse({
      id: "1",
      project_id: "project-1",
      name: "Panel",
      width: 18,
      height: 720,
      depth: 600,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      rotation_y: 0,
      color: "#8B7355",
      material_template_id: null,
      component_id: null,
      is_independent: 0,
      created_at: 1,
      updated_at: 1,
    });

    expect(furnitureObject.name).toBe("Panel");

    const template = MaterialTemplateSchema.parse({
      id: "template-1",
      name: "Korpus",
      description: "",
      base_color: "#C4A882",
      created_at: 1,
      updated_at: 1,
      layers: [],
    });

    expect(template.layers).toHaveLength(0);
    expect(OPPOSITE_SIDES.front).toBe("back");
    expect(SIDE_LABELS.left).toBe("Lewo");
  });

  test("relation schemas describe available synchronization modes", () => {
    const relation = ObjectRelationSchema.parse({
      id: "rel-1",
      project_id: "project-1",
      source_object_id: "source-1",
      target_object_id: "target-1",
      relation_type: "attachment",
      source_field: "position_x",
      target_field: "position_x",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 18,
      created_at: 1,
    });

    expect(relation.mode).toBe("anchor");
    expect(RELATION_TYPE_LABELS.dimension).toContain("Synchronizacja");
    expect(RELATION_MODE_LABELS.relative).toContain("Relatywna");
    expect(RELATION_FIELD_LABELS.position_x).toContain("Pozycja");
  });
});
