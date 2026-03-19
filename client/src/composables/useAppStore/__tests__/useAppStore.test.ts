import { describe, expect, test } from "bun:test";
import { useAppStore } from "../useAppStore";

// useAppStore is a Pinia store that requires Vue + Pinia setup to fully test.
// These tests verify the store module can be imported and has the expected shape.
describe("useAppStore composable", () => {
  test("useAppStore is exported as a function", () => {
    expect(typeof useAppStore).toBe("function");
  });

  test("useAppStore.$id is 'app'", () => {
    expect(useAppStore.$id).toBe("app");
  });
});
