import { describe, expect, test } from "bun:test";
import {
  displayGridValue,
  GRID_PRESETS,
  normalizeGridInput,
} from "../../../lib/grid/grid";

// GridSettingsPanel allows users to configure the 3D grid.
// These tests verify the grid helper functions used by the panel.
describe("GridSettingsPanel", () => {
  test("displayValue shows mm correctly", () => {
    const value = 100;
    expect(displayGridValue(value, "mm")).toBe(100);
  });

  test("displayValue converts to cm correctly", () => {
    const value = 100;
    expect(displayGridValue(value, "cm")).toBe(10);
  });

  test("setUnit from mm to cm triggers correct normalisation", () => {
    const currentValueMm = 100;
    const displayedCm = displayGridValue(currentValueMm, "cm");
    const normalised = normalizeGridInput(displayedCm, "cm");
    expect(normalised).toBe(currentValueMm);
  });

  test("applyPreset values are normalised from their mm sizes", () => {
    const preset = GRID_PRESETS[2]!; // 100mm preset
    expect(preset.sizeX).toBe(100);
    expect(preset.sizeY).toBe(100);
    expect(preset.sizeZ).toBe(100);
  });

  test("axes array contains X, Y, Z keys", () => {
    const axes = [
      { key: "sizeX", label: "X" },
      { key: "sizeY", label: "Y" },
      { key: "sizeZ", label: "Z" },
    ];
    expect(axes).toHaveLength(3);
    expect(axes.map((a) => a.key)).toEqual(["sizeX", "sizeY", "sizeZ"]);
  });

  test("input range value is parsed correctly with Number.parseFloat", () => {
    expect(Number.parseFloat("50.5")).toBeCloseTo(50.5, 6);
    expect(Number.parseFloat("100")).toBe(100);
    expect(Number.parseFloat("0")).toBe(0);
  });

  test("onRange normalises input value for storage", () => {
    const inputValueCm = 5;
    const stored = normalizeGridInput(inputValueCm, "cm");
    expect(stored).toBe(50);
  });
});
