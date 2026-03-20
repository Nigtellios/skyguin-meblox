import { describe, expect, test } from "bun:test";
import { OBJECT_PRESETS } from "../../../lib/objectPresets/objectPresets";

// AddObjectDialog renders a list of furniture presets and allows the user to
// create a new object. These tests verify the underlying data and logic.
describe("AddObjectDialog", () => {
  test("OBJECT_PRESETS provides items for the dialog to display", () => {
    expect(OBJECT_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  test("presets have all fields required for object creation", () => {
    for (const preset of OBJECT_PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(typeof preset.width).toBe("number");
      expect(typeof preset.height).toBe("number");
      expect(typeof preset.depth).toBe("number");
      expect(typeof preset.label).toBe("string");
    }
  });

  test("preset dimensions are positive values", () => {
    for (const preset of OBJECT_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.depth).toBeGreaterThan(0);
    }
  });
});
