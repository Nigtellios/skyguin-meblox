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
  canConnectFields,
  createBuilderEdgePath,
  createBuilderLayout,
  getFieldAnchorPoint,
  getRelationFieldKind,
} from "../client/src/lib/relationsBuilder";
import {
  anchorMarkerWorldPos,
  computeSnapPosition,
  getObjectSnapAnchors,
} from "../client/src/lib/snapAnchors";
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
      material_type: "wood",
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

  test("relations builder helpers create layouts and compatible connections", () => {
    const layout = createBuilderLayout([
      {
        id: "a",
        project_id: "p",
        name: "A",
        width: 18,
        height: 700,
        depth: 560,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        rotation_y: 0,
        color: "#8B7355",
        material_type: "wood",
    material_template_id: null,
        component_id: null,
        is_independent: 0,
        created_at: 1,
        updated_at: 1,
      },
      {
        id: "b",
        project_id: "p",
        name: "B",
        width: 18,
        height: 700,
        depth: 560,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        rotation_y: 0,
        color: "#8B7355",
        material_type: "wood",
    material_template_id: null,
        component_id: null,
        is_independent: 0,
        created_at: 1,
        updated_at: 1,
      },
    ]);

    expect(layout.a.x).toBeLessThan(layout.b.x);
    expect(getRelationFieldKind("width")).toBe("dimension");
    expect(getRelationFieldKind("position_x")).toBe("position");
    expect(canConnectFields("height", "depth", "visual")).toBe(true);
    expect(canConnectFields("height", "position_x", "visual")).toBe(false);
    expect(canConnectFields("position_x", "position_z", "attach")).toBe(true);

    const start = getFieldAnchorPoint(layout.a, 0, "right");
    const end = getFieldAnchorPoint(layout.b, 1, "left");
    expect(createBuilderEdgePath(start, end)).toContain("C");
  });

  test("snap anchors expose visible markers and close gaps between objects", () => {
    const source = {
      id: "source",
      project_id: "p",
      name: "Źródło",
      width: 18,
      height: 720,
      depth: 600,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      rotation_y: 0,
      color: "#8B7355",
      material_type: "wood",
    material_template_id: null,
      component_id: null,
      is_independent: 0,
      created_at: 1,
      updated_at: 1,
    };
    const target = {
      ...source,
      id: "target",
      name: "Cel",
      position_x: 250,
    };

    const anchors = getObjectSnapAnchors(source);
    expect(anchors).toHaveLength(18);
    expect(anchors.filter((anchor) => anchor.type === "face")).toHaveLength(6);
    expect(anchors.filter((anchor) => anchor.type === "edge")).toHaveLength(12);

    const rightFace = anchors[0];
    const rightMarker = anchorMarkerWorldPos(source, rightFace, 14);
    expect(rightMarker.x).toBeCloseTo(
      source.position_x + source.width / 2 + 14,
      6,
    );
    expect(rightMarker.y).toBeCloseTo(source.height / 2, 6);

    const snapped = computeSnapPosition(source, anchors[0], target, anchors[1]);
    expect(snapped.position_x + source.width / 2).toBeCloseTo(
      target.position_x - target.width / 2,
      6,
    );
    expect(snapped.position_z).toBeCloseTo(target.position_z, 6);
  });
});
