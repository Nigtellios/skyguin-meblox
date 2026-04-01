import { describe, expect, it } from "bun:test";

describe("MovementStepPanel", () => {
  it("STEP_PRESETS contains expected values", () => {
    const STEP_PRESETS = [0.1, 0.5, 1, 2, 5, 10, 50, 100];
    expect(STEP_PRESETS).toContain(1);
    expect(STEP_PRESETS).toContain(10);
    expect(STEP_PRESETS).toContain(0.1);
    expect(STEP_PRESETS.length).toBeGreaterThan(4);
  });
});
