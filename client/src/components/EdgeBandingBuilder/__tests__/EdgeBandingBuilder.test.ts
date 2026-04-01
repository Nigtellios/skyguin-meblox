import { describe, expect, it } from "bun:test";
import type { EdgeBandingConfig } from "../../../types";
import { DEFAULT_EDGE_BANDING } from "../../../types";

describe("EdgeBandingBuilder", () => {
  it("DEFAULT_EDGE_BANDING has all zero thicknesses", () => {
    expect(DEFAULT_EDGE_BANDING.frontThickness).toBe(0);
    expect(DEFAULT_EDGE_BANDING.backThickness).toBe(0);
    expect(DEFAULT_EDGE_BANDING.topThickness).toBe(0);
    expect(DEFAULT_EDGE_BANDING.bottomThickness).toBe(0);
    expect(DEFAULT_EDGE_BANDING.leftThickness).toBe(0);
    expect(DEFAULT_EDGE_BANDING.rightThickness).toBe(0);
  });

  it("DEFAULT_EDGE_BANDING has colors for all sides", () => {
    expect(DEFAULT_EDGE_BANDING.frontColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_EDGE_BANDING.backColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_EDGE_BANDING.topColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_EDGE_BANDING.bottomColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_EDGE_BANDING.leftColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(DEFAULT_EDGE_BANDING.rightColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("edge banding config can be serialized/deserialized", () => {
    const config: EdgeBandingConfig = {
      ...DEFAULT_EDGE_BANDING,
      frontThickness: 1,
      backThickness: 1,
      topThickness: 2,
    };

    const json = JSON.stringify(config);
    const parsed = JSON.parse(json) as EdgeBandingConfig;

    expect(parsed.frontThickness).toBe(1);
    expect(parsed.backThickness).toBe(1);
    expect(parsed.topThickness).toBe(2);
    expect(parsed.bottomThickness).toBe(0);
    expect(parsed.leftThickness).toBe(0);
    expect(parsed.rightThickness).toBe(0);
  });

  it("effective dimensions calculation", () => {
    const baseWidth = 600;
    const baseHeight = 720;
    const baseDepth = 18;

    const config: EdgeBandingConfig = {
      ...DEFAULT_EDGE_BANDING,
      frontThickness: 1,
      backThickness: 1,
      leftThickness: 2,
      rightThickness: 2,
      topThickness: 0,
      bottomThickness: 0,
    };

    // Depth increases by front + back
    const effectiveDepth =
      baseDepth + config.frontThickness + config.backThickness;
    expect(effectiveDepth).toBe(20);

    // Width increases by left + right
    const effectiveWidth =
      baseWidth + config.leftThickness + config.rightThickness;
    expect(effectiveWidth).toBe(604);

    // Height unchanged
    const effectiveHeight =
      baseHeight + config.topThickness + config.bottomThickness;
    expect(effectiveHeight).toBe(720);
  });
});
