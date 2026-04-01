import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  anchorMarkerWorldPos,
  getObjectSnapAnchors,
} from "../../../lib/snapAnchors";
import {
  beginPointerGesture,
  CANVAS_CLICK_DRAG_THRESHOLD_PX,
  shouldDeselectFromCanvasClick,
  updatePointerGesture,
  wasPointerDrag,
} from "../sceneCanvasInteractions";

const appSource = readFileSync(
  new URL("../../../App.vue", import.meta.url),
  "utf8",
);

describe("SceneCanvas", () => {
  const sampleObject = {
    id: "obj",
    project_id: "proj",
    name: "Element",
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
    material_template_id: null,
    component_id: null,
    is_independent: 0,
    created_at: 1,
    updated_at: 1,
  };

  test("snap anchors are generated for objects in the scene", () => {
    const anchors = getObjectSnapAnchors(sampleObject);
    expect(anchors).toHaveLength(18);
    expect(anchors.filter((a) => a.type === "face")).toHaveLength(6);
    expect(anchors.filter((a) => a.type === "edge")).toHaveLength(12);
  });

  test("anchor marker world position is computed correctly", () => {
    const anchors = getObjectSnapAnchors(sampleObject);
    const MARKER_OFFSET = 14;
    const rightFace = anchors[0]!;
    const markerPos = anchorMarkerWorldPos(
      sampleObject,
      rightFace,
      MARKER_OFFSET,
    );
    expect(markerPos.x).toBeGreaterThan(sampleObject.position_x);
  });

  test("pointer gesture stays a click while movement remains below the drag threshold", () => {
    let gesture: ReturnType<typeof beginPointerGesture> | null =
      beginPointerGesture({ clientX: 100, clientY: 100 });

    gesture = updatePointerGesture(gesture, {
      clientX: 100 + CANVAS_CLICK_DRAG_THRESHOLD_PX - 1,
      clientY: 100,
    });

    expect(wasPointerDrag(gesture)).toBe(false);
  });

  test("pointer gesture becomes a drag after exceeding the threshold", () => {
    let gesture: ReturnType<typeof beginPointerGesture> | null =
      beginPointerGesture({ clientX: 10, clientY: 10 });

    gesture = updatePointerGesture(gesture, {
      clientX: 10 + CANVAS_CLICK_DRAG_THRESHOLD_PX,
      clientY: 10,
    });

    expect(wasPointerDrag(gesture)).toBe(true);
  });

  test("clear floor click without modifiers deselects the current object", () => {
    const gesture = beginPointerGesture({ clientX: 40, clientY: 50 });

    expect(
      shouldDeselectFromCanvasClick({
        gesture,
        clickTarget: { type: "floor" },
        isMultiSelect: false,
      }),
    ).toBe(true);
  });

  test("background click after dragging the camera does not deselect", () => {
    let gesture: ReturnType<typeof beginPointerGesture> | null =
      beginPointerGesture({ clientX: 40, clientY: 50 });
    gesture = updatePointerGesture(gesture, { clientX: 60, clientY: 50 });

    expect(
      shouldDeselectFromCanvasClick({
        gesture,
        clickTarget: { type: "background" },
        isMultiSelect: false,
      }),
    ).toBe(false);
  });

  test("clicking another object never triggers background deselection logic", () => {
    const gesture = beginPointerGesture({ clientX: 5, clientY: 5 });

    expect(
      shouldDeselectFromCanvasClick({
        gesture,
        clickTarget: { type: "object", id: "cabinet-2" },
        isMultiSelect: false,
      }),
    ).toBe(false);
  });

  test("multi-select modifier preserves selection even on empty background click", () => {
    const gesture = beginPointerGesture({ clientX: 5, clientY: 5 });

    expect(
      shouldDeselectFromCanvasClick({
        gesture,
        clickTarget: { type: "background" },
        isMultiSelect: true,
      }),
    ).toBe(false);
  });

  test("App imports SceneCanvas as a runtime component", () => {
    expect(appSource).toContain(
      'import SceneCanvas from "./components/SceneCanvas/SceneCanvas.vue";',
    );
    expect(appSource).not.toContain(
      'import type SceneCanvas from "./components/SceneCanvas/SceneCanvas.vue";',
    );
  });
});
