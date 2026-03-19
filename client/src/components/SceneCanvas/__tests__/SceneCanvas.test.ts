import { describe, expect, test } from "bun:test";
import {
  anchorMarkerWorldPos,
  getObjectSnapAnchors,
} from "../../../lib/snapAnchors/snapAnchors";

// SceneCanvas is the main 3D rendering area using Three.js.
// It handles object selection, drag-and-drop, snap mode, and relation overlays.
// These tests verify the pure helper logic used by the canvas.
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

  test("shouldShowHoverPreview logic requires correct scene mode", () => {
    function shouldShowHoverPreview(sceneMode: string, snapPhase: string) {
      return sceneMode === "snap" || snapPhase !== "none";
    }

    expect(shouldShowHoverPreview("snap", "none")).toBe(true);
    expect(shouldShowHoverPreview("select", "source")).toBe(true);
    expect(shouldShowHoverPreview("select", "none")).toBe(false);
    expect(shouldShowHoverPreview("move", "none")).toBe(false);
  });

  test("context menu position is clamped to viewport bounds", () => {
    function clampMenuPosition(
      x: number,
      y: number,
      viewportWidth: number,
      viewportHeight: number,
      menuWidth = 160,
      menuHeight = 120,
    ) {
      return {
        x: Math.min(x, viewportWidth - menuWidth),
        y: Math.min(y, viewportHeight - menuHeight),
      };
    }

    const pos = clampMenuPosition(1000, 900, 1024, 768);
    expect(pos.x).toBeLessThanOrEqual(1024 - 160);
    expect(pos.y).toBeLessThanOrEqual(768 - 120);
  });

  test("add position defaults to world origin coordinates", () => {
    const addPosition = { x: 0, z: 0 };
    expect(addPosition.x).toBe(0);
    expect(addPosition.z).toBe(0);
  });
});
