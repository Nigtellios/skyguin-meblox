import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  DEFAULT_SHADOW_MAP_TYPE,
  resolveCanvasRenderSize,
  resolveSceneClickTargetFromHits,
  useScene,
} from "../useScene";

describe("useScene composable", () => {
  test("is exported as a function", () => {
    expect(typeof useScene).toBe("function");
  });

  test("uses the supported PCFShadowMap renderer mode", () => {
    expect(DEFAULT_SHADOW_MAP_TYPE).toBe(THREE.PCFShadowMap);
  });

  test("resolveCanvasRenderSize falls back to parent dimensions when canvas reports 0x0", () => {
    const size = resolveCanvasRenderSize({
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
      } as DOMRect),
      parentElement: {
        clientWidth: 1280,
        clientHeight: 720,
      } as HTMLElement,
    });

    expect(size).toEqual({ width: 1280, height: 720 });
  });

  test("resolveCanvasRenderSize prefers the largest measurable canvas size", () => {
    const size = resolveCanvasRenderSize({
      clientWidth: 600,
      clientHeight: 320,
      getBoundingClientRect: () => ({
        width: 640.4,
        height: 360.2,
      } as DOMRect),
      parentElement: {
        clientWidth: 620,
        clientHeight: 350,
      } as HTMLElement,
    });

    expect(size).toEqual({ width: 640, height: 360 });
  });

  test("resolveCanvasRenderSize never returns zero dimensions", () => {
    const size = resolveCanvasRenderSize({
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
      } as DOMRect),
      parentElement: null,
    });

    expect(size.width).toBe(1);
    expect(size.height).toBe(1);
  });

  test("resolveSceneClickTargetFromHits prefers furniture objects over the floor", () => {
    expect(
      resolveSceneClickTargetFromHits([
        { userData: { type: "furniture", id: "cabinet-1" } },
        { name: "__floor__" },
      ]),
    ).toEqual({ type: "object", id: "cabinet-1" });
  });

  test("resolveSceneClickTargetFromHits recognizes floor hits", () => {
    expect(resolveSceneClickTargetFromHits([{ name: "__floor__" }])).toEqual({
      type: "floor",
    });
  });

  test("resolveSceneClickTargetFromHits falls back to background when nothing actionable was hit", () => {
    expect(resolveSceneClickTargetFromHits([])).toEqual({
      type: "background",
    });
    expect(resolveSceneClickTargetFromHits([{ name: "ambient-light" }])).toEqual({
      type: "background",
    });
  });
});
