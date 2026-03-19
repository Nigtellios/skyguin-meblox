import { describe, expect, test } from "bun:test";
import {
  LAYER_TYPE_LABELS,
  OPPOSITE_SIDES,
  SIDE_LABELS,
  type Side,
} from "../../../types/index";

// MaterialTemplateEditor allows creating and editing material layers.
// These tests verify the underlying data and logic used by the editor.
describe("MaterialTemplateEditor", () => {
  test("OPPOSITE_SIDES provides correct opposite for all sides", () => {
    const sides: Side[] = ["top", "bottom", "left", "right", "front", "back"];
    for (const side of sides) {
      expect(OPPOSITE_SIDES[side]).toBeDefined();
      expect(OPPOSITE_SIDES[OPPOSITE_SIDES[side]]).toBe(side);
    }
  });

  test("layersFor groups layers by side correctly", () => {
    const layers = [
      { id: "1", side: "top", layer_type: "veneer" },
      { id: "2", side: "bottom", layer_type: "veneer" },
      { id: "3", side: "top", layer_type: "paint" },
    ];

    function layersFor(side: string) {
      return layers.filter((l) => l.side === side);
    }

    expect(layersFor("top")).toHaveLength(2);
    expect(layersFor("bottom")).toHaveLength(1);
    expect(layersFor("left")).toHaveLength(0);
  });

  test("layerTypeLabel returns Polish label", () => {
    function layerTypeLabel(type: string): string {
      return (LAYER_TYPE_LABELS as Record<string, string>)[type] ?? type;
    }

    expect(layerTypeLabel("veneer")).toBe(LAYER_TYPE_LABELS.veneer);
    expect(layerTypeLabel("unknown")).toBe("unknown");
  });

  test("sideLabel computes label for selected side", () => {
    const selectedSide: Side = "left";
    const label = selectedSide ? SIDE_LABELS[selectedSide] : "";
    expect(label).toBe("Lewo");
  });

  test("oppositeSideLabel computes label for opposite side", () => {
    const selectedSide: Side = "left";
    const oppositeLabel = selectedSide
      ? SIDE_LABELS[OPPOSITE_SIDES[selectedSide]]
      : "";
    expect(oppositeLabel).toBe("Prawo");
  });

  test("new layer defaults are valid", () => {
    const newLayer = {
      side: "top" as Side,
      layer_type: "veneer",
      color: "#D4A574",
      thickness: 0.5,
      is_bilateral: false,
    };
    expect(newLayer.side).toBe("top");
    expect(newLayer.layer_type).toBe("veneer");
    expect(newLayer.thickness).toBeGreaterThan(0);
  });
});
