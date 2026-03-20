import { describe, expect, test } from "bun:test";
import {
  BUILDER_LAYOUT_PADDING,
  BUILDER_NODE_GAP_X,
  BUILDER_NODE_WIDTH,
  canConnectFields,
  createBuilderEdgePath,
  createBuilderLayout,
  estimateRelationLabelWidth,
  getFieldAnchorPoint,
  getRelationFieldKind,
} from "../relationsBuilder";

const sampleObject = {
  id: "obj-1",
  project_id: "proj",
  name: "Bok",
  width: 18,
  height: 720,
  depth: 560,
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
};

const sampleObject2 = { ...sampleObject, id: "obj-2", name: "Półka" };

describe("relationsBuilder lib", () => {
  test("getRelationFieldKind returns dimension for dimension fields", () => {
    expect(getRelationFieldKind("width")).toBe("dimension");
    expect(getRelationFieldKind("height")).toBe("dimension");
    expect(getRelationFieldKind("depth")).toBe("dimension");
  });

  test("getRelationFieldKind returns position for position fields", () => {
    expect(getRelationFieldKind("position_x")).toBe("position");
    expect(getRelationFieldKind("position_y")).toBe("position");
    expect(getRelationFieldKind("position_z")).toBe("position");
  });

  test("canConnectFields in visual mode allows dimension-dimension connections", () => {
    expect(canConnectFields("width", "height", "visual")).toBe(true);
    expect(canConnectFields("height", "depth", "visual")).toBe(true);
    expect(canConnectFields("width", "depth", "visual")).toBe(true);
  });

  test("canConnectFields in visual mode rejects mixed connections", () => {
    expect(canConnectFields("width", "position_x", "visual")).toBe(false);
    expect(canConnectFields("position_x", "height", "visual")).toBe(false);
  });

  test("canConnectFields in attach mode allows position-position connections", () => {
    expect(canConnectFields("position_x", "position_x", "attach")).toBe(true);
    expect(canConnectFields("position_x", "position_z", "attach")).toBe(true);
    expect(canConnectFields("position_y", "position_z", "attach")).toBe(true);
  });

  test("canConnectFields in attach mode rejects dimension fields", () => {
    expect(canConnectFields("width", "position_x", "attach")).toBe(false);
    expect(canConnectFields("position_x", "depth", "attach")).toBe(false);
  });

  test("createBuilderLayout places objects in columns", () => {
    const layout = createBuilderLayout([sampleObject, sampleObject2]);
    expect(layout["obj-1"]).toBeDefined();
    expect(layout["obj-2"]).toBeDefined();
    expect(layout["obj-1"]?.x).toBeLessThan(layout["obj-2"]?.x);
    expect(layout["obj-1"]?.x).toBe(BUILDER_LAYOUT_PADDING);
    expect(layout["obj-2"]?.x).toBe(
      BUILDER_LAYOUT_PADDING + BUILDER_NODE_GAP_X,
    );
  });

  test("createBuilderLayout preserves existing positions", () => {
    const existingPos = { "obj-1": { id: "obj-1", x: 999, y: 888 } };
    const layout = createBuilderLayout(
      [sampleObject, sampleObject2],
      existingPos,
    );
    expect(layout["obj-1"]?.x).toBe(999);
    expect(layout["obj-1"]?.y).toBe(888);
  });

  test("getFieldAnchorPoint returns correct right anchor", () => {
    const nodeLayout = { id: "obj-1", x: 100, y: 50 };
    const anchor = getFieldAnchorPoint(nodeLayout, 0, "right");
    expect(anchor.x).toBe(100 + BUILDER_NODE_WIDTH);
  });

  test("getFieldAnchorPoint returns correct left anchor", () => {
    const nodeLayout = { id: "obj-1", x: 200, y: 50 };
    const anchor = getFieldAnchorPoint(nodeLayout, 0, "left");
    expect(anchor.x).toBe(200);
  });

  test("createBuilderEdgePath returns SVG path with cubic bezier", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 200, y: 100 };
    const path = createBuilderEdgePath(start, end);
    expect(path).toContain("M");
    expect(path).toContain("C");
  });

  test("estimateRelationLabelWidth respects minimum width", () => {
    const minWidth = 100;
    expect(estimateRelationLabelWidth("", minWidth)).toBe(minWidth);
    expect(estimateRelationLabelWidth("a", minWidth)).toBeGreaterThanOrEqual(
      minWidth,
    );
  });

  test("estimateRelationLabelWidth grows with text length", () => {
    const short = estimateRelationLabelWidth("ab", 0);
    const long = estimateRelationLabelWidth("abcdefghij", 0);
    expect(long).toBeGreaterThan(short);
  });

  test("createBuilderLayout handles empty objects list", () => {
    const layout = createBuilderLayout([]);
    expect(Object.keys(layout)).toHaveLength(0);
  });
});
