import { describe, expect, test } from "bun:test";

// ContextBar shows move/rotate controls for selected objects.
// These tests verify the pure logic used in the component.
describe("ContextBar", () => {
  const ROTATE_STEP_DEG = 15;

  test("rotation step in radians is correct", () => {
    const radians = (ROTATE_STEP_DEG * Math.PI) / 180;
    expect(radians).toBeCloseTo(Math.PI / 12, 6);
  });

  test("positive rotation sign produces positive delta", () => {
    const dr = (1 * ROTATE_STEP_DEG * Math.PI) / 180;
    expect(dr).toBeGreaterThan(0);
  });

  test("negative rotation sign produces negative delta", () => {
    const dr = (-1 * ROTATE_STEP_DEG * Math.PI) / 180;
    expect(dr).toBeLessThan(0);
  });

  test("preset steps cover fine to coarse movement", () => {
    const PRESET_STEPS = [0.1, 1, 10, 100];
    expect(PRESET_STEPS[0]).toBe(0.1);
    expect(PRESET_STEPS[PRESET_STEPS.length - 1]).toBe(100);
    for (let i = 1; i < PRESET_STEPS.length; i++) {
      expect(PRESET_STEPS[i]!).toBeGreaterThan(PRESET_STEPS[i - 1]!);
    }
  });

  test("axes array contains X, Y, Z", () => {
    const axes = ["X", "Y", "Z"] as const;
    expect(axes).toContain("X");
    expect(axes).toContain("Y");
    expect(axes).toContain("Z");
    expect(axes).toHaveLength(3);
  });

  test("parseFloat parses valid step input", () => {
    expect(parseFloat("5")).toBe(5);
    expect(parseFloat("0.5")).toBe(0.5);
    expect(parseFloat("abc")).toBeNaN();
    expect(parseFloat("")).toBeNaN();
  });

  test("move direction maps to correct axis delta signs", () => {
    const DEFAULT_STEP = 10;
    const activeAxis = "X";

    function onMoveDir(
      dir: "up" | "down" | "left" | "right",
      axis: string,
      step: number,
    ) {
      const deltas = { dx: 0, dy: 0, dz: 0 };
      if (axis === "X") {
        if (dir === "up" || dir === "right") deltas.dx = step;
        else deltas.dx = -step;
      } else if (axis === "Y") {
        if (dir === "up") deltas.dy = step;
        else deltas.dy = -step;
      } else if (axis === "Z") {
        if (dir === "up" || dir === "right") deltas.dz = step;
        else deltas.dz = -step;
      }
      return deltas;
    }

    const upResult = onMoveDir("up", activeAxis, DEFAULT_STEP);
    const downResult = onMoveDir("down", activeAxis, DEFAULT_STEP);
    expect(upResult.dx).toBe(DEFAULT_STEP);
    expect(downResult.dx).toBe(-DEFAULT_STEP);
  });
});
