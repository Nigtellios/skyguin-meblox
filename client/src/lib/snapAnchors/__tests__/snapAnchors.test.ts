import { describe, expect, test } from "bun:test";
import {
  anchorMarkerWorldPos,
  anchorWorldPos,
  computeSnapPosition,
  getObjectSnapAnchors,
} from "../snapAnchors";

const baseObject = {
  id: "obj",
  project_id: "proj",
  name: "Element",
  width: 18,
  height: 720,
  depth: 560,
  position_x: 0,
  position_y: 0,
  position_z: 0,
  rotation_y: 0,
  color: "#8B7355",
  material_template_id: null,
  component_id: null,
  is_independent: 0,
  created_at: 1,
  updated_at: 1,
};

describe("snapAnchors lib", () => {
  test("getObjectSnapAnchors returns 18 anchors", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    expect(anchors).toHaveLength(18);
  });

  test("6 anchors are face type and 12 are edge type", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    expect(anchors.filter((a) => a.type === "face")).toHaveLength(6);
    expect(anchors.filter((a) => a.type === "edge")).toHaveLength(12);
  });

  test("anchor indices are 0-17 without gaps", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    const indices = anchors.map((a) => a.index).sort((a, b) => a - b);
    for (let i = 0; i < 18; i++) {
      expect(indices[i]).toBe(i);
    }
  });

  test("face anchor offsets respect object half-dimensions", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    const rightFace = anchors.find((a) => a.index === 0)!;
    expect(rightFace.type).toBe("face");
    expect(rightFace.lx).toBeCloseTo(baseObject.width / 2, 6);
    expect(rightFace.ly).toBe(0);
    expect(rightFace.lz).toBe(0);
  });

  test("anchorWorldPos computes correct world position", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    const rightFace = anchors[0]!;
    const worldPos = anchorWorldPos(baseObject, rightFace);
    expect(worldPos.x).toBeCloseTo(
      baseObject.position_x + baseObject.width / 2,
      6,
    );
    expect(worldPos.y).toBeCloseTo(
      baseObject.position_y + baseObject.height / 2,
      6,
    );
    expect(worldPos.z).toBeCloseTo(baseObject.position_z, 6);
  });

  test("anchorMarkerWorldPos offsets marker away from surface", () => {
    const anchors = getObjectSnapAnchors(baseObject);
    const rightFace = anchors[0]!;
    const markerOffset = 14;
    const marker = anchorMarkerWorldPos(baseObject, rightFace, markerOffset);
    const world = anchorWorldPos(baseObject, rightFace);
    expect(marker.x).toBeGreaterThan(world.x);
  });

  test("computeSnapPosition aligns source right face to target left face", () => {
    const source = { ...baseObject, id: "source", position_x: 0 };
    const target = {
      ...baseObject,
      id: "target",
      position_x: 250,
      width: 18,
    };
    const sourceAnchors = getObjectSnapAnchors(source);
    const targetAnchors = getObjectSnapAnchors(target);
    const rightAnchor = sourceAnchors[0]!;
    const leftAnchor = targetAnchors[1]!;

    const snapped = computeSnapPosition(
      source,
      rightAnchor,
      target,
      leftAnchor,
    );
    expect(snapped.position_x + source.width / 2).toBeCloseTo(
      target.position_x - target.width / 2,
      6,
    );
  });

  test("computeSnapPosition preserves unsnapped axes", () => {
    const source = { ...baseObject, id: "source", position_z: 0 };
    const target = {
      ...baseObject,
      id: "target",
      position_x: 100,
      position_z: 0,
    };
    const sourceAnchors = getObjectSnapAnchors(source);
    const targetAnchors = getObjectSnapAnchors(target);

    const snapped = computeSnapPosition(
      source,
      sourceAnchors[0]!,
      target,
      targetAnchors[1]!,
    );
    expect(snapped.position_z).toBeCloseTo(target.position_z, 6);
  });

  test("getObjectSnapAnchors works with non-zero position", () => {
    const obj = { ...baseObject, position_x: 500, position_y: 100 };
    const anchors = getObjectSnapAnchors(obj);
    expect(anchors).toHaveLength(18);
  });
});
