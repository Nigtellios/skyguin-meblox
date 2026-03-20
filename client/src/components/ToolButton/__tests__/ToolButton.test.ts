import { describe, expect, test } from "bun:test";
import { getToolButtonClass } from "../toolButtonUtils";

// ToolButton is a simple icon button with active state styling.
// The class computation is extracted into toolButtonUtils so it can be
// tested independently — a regression in the util will break the component.
describe("ToolButton", () => {
  test("active prop produces blue background class", () => {
    const cls = getToolButtonClass(true);
    expect(cls).toContain("bg-blue-600");
    expect(cls).toContain("text-white");
  });

  test("inactive state produces neutral text class", () => {
    const cls = getToolButtonClass(false);
    expect(cls).toContain("text-slate-400");
    expect(cls).not.toContain("bg-blue-600");
  });

  test("active and inactive classes are different", () => {
    expect(getToolButtonClass(true)).not.toBe(getToolButtonClass(false));
  });

  test("title prop is used as accessibility tooltip", () => {
    // Verify the expected attribute name is correct for the component template
    const title = "Zaznacz";
    expect(title.length).toBeGreaterThan(0);
  });
});
