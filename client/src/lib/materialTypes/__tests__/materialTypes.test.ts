import { describe, expect, it } from "bun:test";
import {
  EDGE_BANDING_MATERIALS,
  MATERIAL_DEFAULT_COLORS,
  MATERIAL_METALNESS,
  MATERIAL_ROUGHNESS,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPES,
  METALLIC_MATERIALS,
} from "../materialTypes";

describe("materialTypes", () => {
  it("has 8 material types", () => {
    expect(MATERIAL_TYPES.length).toBe(8);
  });

  it("all material types have labels", () => {
    for (const type of MATERIAL_TYPES) {
      expect(MATERIAL_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("all material types have default colors", () => {
    for (const type of MATERIAL_TYPES) {
      expect(MATERIAL_DEFAULT_COLORS[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("metallic materials are steel, stainless_steel, aluminum", () => {
    expect(METALLIC_MATERIALS.has("steel")).toBe(true);
    expect(METALLIC_MATERIALS.has("stainless_steel")).toBe(true);
    expect(METALLIC_MATERIALS.has("aluminum")).toBe(true);
    expect(METALLIC_MATERIALS.has("wood")).toBe(false);
    expect(METALLIC_MATERIALS.has("plastic")).toBe(false);
  });

  it("edge banding materials are wood, furniture_board, veneered_board", () => {
    expect(EDGE_BANDING_MATERIALS.has("wood")).toBe(true);
    expect(EDGE_BANDING_MATERIALS.has("furniture_board")).toBe(true);
    expect(EDGE_BANDING_MATERIALS.has("veneered_board")).toBe(true);
    expect(EDGE_BANDING_MATERIALS.has("steel")).toBe(false);
    expect(EDGE_BANDING_MATERIALS.has("plastic")).toBe(false);
    expect(EDGE_BANDING_MATERIALS.has("unspecified")).toBe(false);
  });

  it("metallic materials have metalness and roughness values", () => {
    for (const type of METALLIC_MATERIALS) {
      expect(MATERIAL_METALNESS[type]).toBeGreaterThan(0);
      expect(MATERIAL_ROUGHNESS[type]).toBeGreaterThan(0);
      expect(MATERIAL_ROUGHNESS[type]).toBeLessThan(1);
    }
  });

  it("default colors are distinct for different metals", () => {
    expect(MATERIAL_DEFAULT_COLORS.steel).not.toBe(
      MATERIAL_DEFAULT_COLORS.stainless_steel,
    );
    expect(MATERIAL_DEFAULT_COLORS.steel).not.toBe(
      MATERIAL_DEFAULT_COLORS.aluminum,
    );
    expect(MATERIAL_DEFAULT_COLORS.stainless_steel).not.toBe(
      MATERIAL_DEFAULT_COLORS.aluminum,
    );
  });
});
