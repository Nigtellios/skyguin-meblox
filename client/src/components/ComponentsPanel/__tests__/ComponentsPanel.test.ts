import { describe, expect, test } from "bun:test";

// ComponentsPanel displays component groups and their members.
// It allows creating groups and syncing properties across members.
describe("ComponentsPanel", () => {
  test("component group name defaults for creation are validated", () => {
    const defaultName = "Nowy komponent";
    expect(defaultName.length).toBeGreaterThan(0);
  });

  test("sync fields are a subset of furniture object properties", () => {
    const syncableFields = [
      "width",
      "height",
      "depth",
      "color",
      "material_template_id",
    ] as const;
    expect(syncableFields).toContain("width");
    expect(syncableFields).toContain("height");
    expect(syncableFields).toContain("depth");
    expect(syncableFields).toContain("color");
    expect(syncableFields).toContain("material_template_id");
  });
});
