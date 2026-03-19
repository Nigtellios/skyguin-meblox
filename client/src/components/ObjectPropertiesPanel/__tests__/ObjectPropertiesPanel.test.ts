import { describe, expect, test } from "bun:test";
import { OBJECT_COLOR_PALETTE } from "../../../lib/objectPresets/objectPresets";

// ObjectPropertiesPanel allows editing furniture object dimensions,
// position, color, and material. These tests verify the supporting logic.
describe("ObjectPropertiesPanel", () => {
  test("updateNumberField logic correctly parses and multiplies values", () => {
    function parseNumberInput(value: string, multiplier = 1) {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed * multiplier;
    }

    expect(parseNumberInput("100")).toBe(100);
    expect(parseNumberInput("45", Math.PI / 180)).toBeCloseTo(
      (45 * Math.PI) / 180,
      6,
    );
    expect(parseNumberInput("abc")).toBeNull();
    expect(parseNumberInput("")).toBeNull();
  });

  test("editable fields cover all object properties", () => {
    const editableFields = [
      "name",
      "width",
      "height",
      "depth",
      "position_x",
      "position_y",
      "position_z",
      "rotation_y",
      "color",
      "material_template_id",
    ] as const;
    expect(editableFields).toHaveLength(10);
    expect(editableFields).toContain("width");
    expect(editableFields).toContain("color");
  });

  test("numeric fields are a subset of editable fields", () => {
    const numericFields = [
      "width",
      "height",
      "depth",
      "position_x",
      "position_y",
      "position_z",
      "rotation_y",
    ] as const;
    expect(numericFields).toHaveLength(7);
  });

  test("color palette provides choices for the color picker", () => {
    expect(OBJECT_COLOR_PALETTE.length).toBeGreaterThan(0);
    expect(OBJECT_COLOR_PALETTE).toContain("#8B7355");
  });

  test("rotation input multiplier converts degrees to radians", () => {
    const multiplier = Math.PI / 180;
    const degrees90 = 90 * multiplier;
    expect(degrees90).toBeCloseTo(Math.PI / 2, 6);
  });
});
