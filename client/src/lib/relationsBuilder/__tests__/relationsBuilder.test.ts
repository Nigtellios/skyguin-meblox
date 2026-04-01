import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  BUILDER_LAYOUT_PADDING,
  BUILDER_NODE_GAP_X,
  BUILDER_NODE_GAP_Y,
  BUILDER_NODE_WIDTH,
  type BuilderViewState,
  canConnectFields,
  createBuilderEdgePath,
  createBuilderLayout,
  estimateRelationLabelWidth,
  getFieldAnchorPoint,
  getRelationFieldKind,
  loadBuilderLayout,
  loadBuilderViewState,
  saveBuilderLayout,
  saveBuilderViewState,
} from "../relationsBuilder";

// ---------------------------------------------------------------------------
// localStorage mock (not available in the Node/Bun test runtime)
// ---------------------------------------------------------------------------
let _store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => _store[key] ?? null,
  setItem: (key, value) => {
    _store[key] = value;
  },
  removeItem: (key) => {
    delete _store[key];
  },
  clear: () => {
    _store = {};
  },
  key: (index) => Object.keys(_store)[index] ?? null,
  get length() {
    return Object.keys(_store).length;
  },
};
// Set global localStorage for test environment (not available in Bun's Node runtime)
globalThis.localStorage = localStorageMock;

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
  material_type: "wood",
  edge_banding_json: null,
  object_shape: "box",
  edge_rounding_json: null,
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

// ---------------------------------------------------------------------------
// Updated spacing constants
// ---------------------------------------------------------------------------

describe("relationsBuilder spacing constants", () => {
  test("BUILDER_NODE_GAP_X is at least 400 to fit relation labels", () => {
    // Increased from 340 → 420 so relation label text fits without overlapping nodes
    expect(BUILDER_NODE_GAP_X).toBeGreaterThanOrEqual(400);
  });

  test("BUILDER_NODE_GAP_Y is at least 260 for vertical breathing room", () => {
    // Increased from 240 → 280
    expect(BUILDER_NODE_GAP_Y).toBeGreaterThanOrEqual(260);
  });

  test("BUILDER_LAYOUT_PADDING keeps nodes away from the canvas edge", () => {
    // Increased from 48 → 60
    expect(BUILDER_LAYOUT_PADDING).toBeGreaterThanOrEqual(48);
  });

  test("second object in the same row starts after the gap", () => {
    const layout = createBuilderLayout([sampleObject, sampleObject2]);
    const expectedSecondX = BUILDER_LAYOUT_PADDING + BUILDER_NODE_GAP_X;
    expect(layout["obj-2"]?.x).toBe(expectedSecondX);
    // Nodes should not overlap: gap must exceed node width
    expect(BUILDER_NODE_GAP_X).toBeGreaterThan(BUILDER_NODE_WIDTH);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence helpers
// ---------------------------------------------------------------------------

describe("builder layout persistence", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  test("loadBuilderLayout returns null when nothing is stored", () => {
    expect(loadBuilderLayout("proj-1")).toBeNull();
  });

  test("saveBuilderLayout then loadBuilderLayout round-trips the layout", () => {
    const layout = {
      "obj-1": { id: "obj-1", x: 100, y: 200 },
      "obj-2": { id: "obj-2", x: 600, y: 200 },
    };
    saveBuilderLayout("proj-1", layout);
    const loaded = loadBuilderLayout("proj-1");
    expect(loaded).toEqual(layout);
  });

  test("layouts are stored per-project and do not bleed across projects", () => {
    const layoutA = { "obj-1": { id: "obj-1", x: 10, y: 10 } };
    const layoutB = { "obj-2": { id: "obj-2", x: 99, y: 99 } };
    saveBuilderLayout("proj-A", layoutA);
    saveBuilderLayout("proj-B", layoutB);
    expect(loadBuilderLayout("proj-A")).toEqual(layoutA);
    expect(loadBuilderLayout("proj-B")).toEqual(layoutB);
  });

  test("saving overrides previous layout for the same project", () => {
    const v1 = { "obj-1": { id: "obj-1", x: 0, y: 0 } };
    const v2 = { "obj-1": { id: "obj-1", x: 500, y: 300 } };
    saveBuilderLayout("proj-1", v1);
    saveBuilderLayout("proj-1", v2);
    expect(loadBuilderLayout("proj-1")).toEqual(v2);
  });

  test("loadBuilderLayout returns null for invalid JSON", () => {
    // Simulate corrupted storage
    localStorageMock.setItem("vb_layout_proj-bad", "{not valid json}");
    expect(loadBuilderLayout("proj-bad")).toBeNull();
  });
});

describe("builder view-state persistence", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  test("loadBuilderViewState returns null when nothing is stored", () => {
    expect(loadBuilderViewState("proj-1")).toBeNull();
  });

  test("saveBuilderViewState then loadBuilderViewState round-trips the view state", () => {
    const viewState: BuilderViewState = { zoom: 0.75, panX: 120, panY: -40 };
    saveBuilderViewState("proj-1", viewState);
    const loaded = loadBuilderViewState("proj-1");
    expect(loaded).toEqual(viewState);
  });

  test("view states are stored per-project and do not bleed across projects", () => {
    const vsA: BuilderViewState = { zoom: 1, panX: 0, panY: 0 };
    const vsB: BuilderViewState = { zoom: 0.5, panX: 300, panY: 150 };
    saveBuilderViewState("proj-A", vsA);
    saveBuilderViewState("proj-B", vsB);
    expect(loadBuilderViewState("proj-A")).toEqual(vsA);
    expect(loadBuilderViewState("proj-B")).toEqual(vsB);
  });

  test("saving overrides previous view state for the same project", () => {
    const v1: BuilderViewState = { zoom: 1, panX: 0, panY: 0 };
    const v2: BuilderViewState = { zoom: 1.5, panX: -200, panY: -100 };
    saveBuilderViewState("proj-1", v1);
    saveBuilderViewState("proj-1", v2);
    expect(loadBuilderViewState("proj-1")).toEqual(v2);
  });

  test("loadBuilderViewState returns null for invalid JSON", () => {
    localStorageMock.setItem("vb_view_proj-bad", "INVALID");
    expect(loadBuilderViewState("proj-bad")).toBeNull();
  });

  test("zoom value is preserved exactly (no floating-point rounding)", () => {
    const viewState: BuilderViewState = { zoom: 0.15, panX: 0, panY: 0 };
    saveBuilderViewState("proj-zoom", viewState);
    const loaded = loadBuilderViewState("proj-zoom");
    expect(loaded?.zoom).toBe(0.15);
  });
});
