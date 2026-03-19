import { describe, expect, test } from "bun:test";
import { OPPOSITE_SIDES, SIDE_LABELS, type Side } from "../../../types/index";

// SideTile renders a single face of a furniture object for material layer editing.
describe("SideTile", () => {
  test("all 6 sides have labels in SIDE_LABELS", () => {
    const sides: Side[] = ["top", "bottom", "left", "right", "front", "back"];
    for (const side of sides) {
      expect(typeof SIDE_LABELS[side]).toBe("string");
      expect(SIDE_LABELS[side].length).toBeGreaterThan(0);
    }
  });

  test("OPPOSITE_SIDES correctly maps bilateral pairs", () => {
    expect(OPPOSITE_SIDES.top).toBe("bottom");
    expect(OPPOSITE_SIDES.bottom).toBe("top");
    expect(OPPOSITE_SIDES.left).toBe("right");
    expect(OPPOSITE_SIDES.right).toBe("left");
    expect(OPPOSITE_SIDES.front).toBe("back");
    expect(OPPOSITE_SIDES.back).toBe("front");
  });

  test("layer list for a side can be empty", () => {
    const layers: { id: string; side: string }[] = [];
    const topLayers = layers.filter((l) => l.side === "top");
    expect(topLayers).toHaveLength(0);
  });
});
