import { describe, expect, test } from "bun:test";
import {
  displayGridValue,
  GRID_PRESETS,
  type GridUnit,
  normalizeGridInput,
} from "../grid";

describe("grid lib", () => {
  test("displays mm values unchanged", () => {
    expect(displayGridValue(100, "mm")).toBe(100);
    expect(displayGridValue(500, "mm")).toBe(500);
    expect(displayGridValue(0, "mm")).toBe(0);
  });

  test("converts mm to cm by dividing by 10", () => {
    expect(displayGridValue(100, "cm")).toBe(10);
    expect(displayGridValue(500, "cm")).toBe(50);
    expect(displayGridValue(10, "cm")).toBe(1);
  });

  test("normalizes mm input unchanged", () => {
    expect(normalizeGridInput(15, "mm")).toBe(15);
    expect(normalizeGridInput(100, "mm")).toBe(100);
  });

  test("normalizes cm input by multiplying by 10", () => {
    expect(normalizeGridInput(15, "cm")).toBe(150);
    expect(normalizeGridInput(1, "cm")).toBe(10);
    expect(normalizeGridInput(10, "cm")).toBe(100);
  });

  test("displayGridValue and normalizeGridInput are inverse operations", () => {
    const valueMm = 250;
    const units: GridUnit[] = ["mm", "cm"];
    for (const unit of units) {
      const displayed = displayGridValue(valueMm, unit);
      const normalized = normalizeGridInput(displayed, unit);
      expect(normalized).toBe(valueMm);
    }
  });

  test("GRID_PRESETS contains standard sizes", () => {
    expect(GRID_PRESETS.length).toBeGreaterThanOrEqual(4);
    const labels = GRID_PRESETS.map((p) => p.label);
    expect(labels).toContain("100mm");
    expect(labels).toContain("50mm");
    expect(labels).toContain("10mm");
  });

  test("GRID_PRESETS entries have valid dimensions", () => {
    for (const preset of GRID_PRESETS) {
      expect(preset.sizeX).toBeGreaterThan(0);
      expect(preset.sizeY).toBeGreaterThan(0);
      expect(preset.sizeZ).toBeGreaterThan(0);
      expect(typeof preset.label).toBe("string");
    }
  });
});
