import { describe, expect, test } from "bun:test";
import { mount } from "@vue/test-utils";
import ToolButton from "../ToolButton.vue";

// ToolButton is a simple icon button with active state styling.
describe("ToolButton", () => {
  test("active prop controls visual state", () => {
    // When active is true, the button uses blue styling
    // When active is false, it uses neutral styling
    const activeWrapper = mount(ToolButton, {
      props: {
        active: true,
      },
    });
    const inactiveWrapper = mount(ToolButton, {
      props: {
        active: false,
      },
    });

    const activeButton = activeWrapper.find("button");
    const inactiveButton = inactiveWrapper.find("button");

    expect(activeButton.classes()).toContain("bg-blue-600");
    expect(inactiveButton.classes()).toContain("text-slate-400");
    expect(activeButton.classes()).not.toEqual(inactiveButton.classes());
  });

  test("title prop is used as accessibility tooltip", () => {
    const title = "Zaznacz";
    const wrapper = mount(ToolButton, {
      props: {
        title,
      },
    });

    const button = wrapper.find("button");
    expect(button.attributes("title")).toBe(title);
  });
});
