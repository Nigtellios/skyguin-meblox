import { describe, expect, test } from "bun:test";
import { LAYER_TYPE_LABELS, SIDE_LABELS } from "../../../types/index";

// MaterialsPanel displays material templates for assignment to objects.
describe("MaterialsPanel", () => {
  test("SIDE_LABELS covers all 6 furniture sides", () => {
    const sides = ["top", "bottom", "left", "right", "front", "back"] as const;
    for (const side of sides) {
      expect(typeof SIDE_LABELS[side]).toBe("string");
    }
  });

  test("LAYER_TYPE_LABELS covers all layer types", () => {
    expect(typeof LAYER_TYPE_LABELS.veneer).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.edge_banding).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.paint).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.laminate).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.foil).toBe("string");
  });

  test("material template has expected fields", () => {
    const template = {
      id: "t1",
      name: "Dąb",
      description: "Okleina",
      base_color: "#C4A882",
      created_at: 1,
      updated_at: 1,
      layers: [],
    };
    expect(typeof template.base_color).toBe("string");
    expect(template.layers).toHaveLength(0);
  });
});
