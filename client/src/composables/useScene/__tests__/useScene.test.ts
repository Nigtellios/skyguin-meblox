import { describe, expect, test } from "bun:test";
import { useScene } from "../useScene";

// useScene is a Three.js composable that requires WebGL and a DOM canvas.
// These tests verify the module can be imported and exports the expected API.
describe("useScene composable", () => {
  test("useScene is exported as a function", () => {
    expect(typeof useScene).toBe("function");
  });
});
