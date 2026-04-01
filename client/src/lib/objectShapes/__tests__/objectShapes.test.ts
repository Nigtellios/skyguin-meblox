import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EDGE_ROUNDING,
  EDGE_ROUNDING_PRESETS,
  OBJECT_SHAPE_LABELS,
  OBJECT_SHAPES,
} from "../objectShapes";

describe("objectShapes", () => {
  it("has 4 object shapes", () => {
    expect(OBJECT_SHAPES.length).toBe(4);
  });

  it("all shapes have labels", () => {
    for (const shape of OBJECT_SHAPES) {
      expect(OBJECT_SHAPE_LABELS[shape]).toBeTruthy();
    }
  });

  it("DEFAULT_EDGE_ROUNDING has all zero radii", () => {
    expect(DEFAULT_EDGE_ROUNDING.topLeft).toBe(0);
    expect(DEFAULT_EDGE_ROUNDING.topRight).toBe(0);
    expect(DEFAULT_EDGE_ROUNDING.bottomLeft).toBe(0);
    expect(DEFAULT_EDGE_ROUNDING.bottomRight).toBe(0);
  });

  it("EDGE_ROUNDING_PRESETS includes standard carpentry values", () => {
    expect(EDGE_ROUNDING_PRESETS).toContain(0);
    expect(EDGE_ROUNDING_PRESETS).toContain(5);
    expect(EDGE_ROUNDING_PRESETS).toContain(10);
    expect(EDGE_ROUNDING_PRESETS).toContain(25);
  });

  it("box shape is the default rectangular furniture piece", () => {
    expect(OBJECT_SHAPES).toContain("box");
    expect(OBJECT_SHAPE_LABELS.box).toBe("Prostopadłościan");
  });
});
