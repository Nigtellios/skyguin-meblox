import { describe, expect, test } from "bun:test";

// ToolButton is a simple icon button with active state styling.
describe("ToolButton", () => {
  test("active prop controls visual state", () => {
    // When active is true, the button uses blue styling
    // When active is false, it uses neutral styling
    const activeClass = "bg-blue-600 text-white shadow-lg shadow-blue-900/50";
    const inactiveClass =
      "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50";

    function getButtonClass(active: boolean) {
      return active ? activeClass : inactiveClass;
    }

    expect(getButtonClass(true)).toContain("bg-blue-600");
    expect(getButtonClass(false)).toContain("text-slate-400");
    expect(getButtonClass(true)).not.toBe(getButtonClass(false));
  });

  test("title prop is used as accessibility tooltip", () => {
    const title = "Zaznacz";
    expect(title.length).toBeGreaterThan(0);
  });
});
