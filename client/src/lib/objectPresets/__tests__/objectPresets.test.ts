import { describe, expect, test } from "bun:test";
import { OBJECT_COLOR_PALETTE, OBJECT_PRESETS } from "../objectPresets";

describe("objectPresets lib", () => {
  test("presets contain at least 5 furniture items", () => {
    expect(OBJECT_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  test("first preset is corpus side panel", () => {
    expect(OBJECT_PRESETS[0]).toMatchObject({
      name: "Bok korpusu",
      width: 18,
      depth: 600,
    });
  });

  test("all presets have required properties", () => {
    for (const preset of OBJECT_PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.width).toBe("number");
      expect(typeof preset.height).toBe("number");
      expect(typeof preset.depth).toBe("number");
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.depth).toBeGreaterThan(0);
    }
  });

  test("color palette includes wood brown", () => {
    expect(OBJECT_COLOR_PALETTE).toContain("#8B7355");
  });

  test("color palette has enough choices", () => {
    expect(OBJECT_COLOR_PALETTE.length).toBeGreaterThanOrEqual(5);
  });

  test("color palette entries are valid hex colors", () => {
    for (const color of OBJECT_COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
