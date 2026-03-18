import type { FurnitureObject } from "../types";

export type SnapAnchorType = "face" | "edge";

export type SnapAnchor = {
  type: SnapAnchorType;
  /** Local offset from mesh center, in mm */
  lx: number;
  ly: number;
  lz: number;
  index: number;
};

/**
 * Returns 18 snap anchor points for a furniture object:
 *  - indices 0-5:  face centers (red dots)
 *  - indices 6-17: edge midpoints (blue dots)
 */
export function getObjectSnapAnchors(obj: FurnitureObject): SnapAnchor[] {
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const hd = obj.depth / 2;

  return [
    // 6 face centers — type 'face'
    { type: "face", lx: hw, ly: 0, lz: 0, index: 0 }, // right
    { type: "face", lx: -hw, ly: 0, lz: 0, index: 1 }, // left
    { type: "face", lx: 0, ly: hh, lz: 0, index: 2 }, // top
    { type: "face", lx: 0, ly: -hh, lz: 0, index: 3 }, // bottom
    { type: "face", lx: 0, ly: 0, lz: hd, index: 4 }, // front
    { type: "face", lx: 0, ly: 0, lz: -hd, index: 5 }, // back

    // 12 edge midpoints — type 'edge'
    { type: "edge", lx: 0, ly: hh, lz: hd, index: 6 }, // top-front
    { type: "edge", lx: 0, ly: hh, lz: -hd, index: 7 }, // top-back
    { type: "edge", lx: hw, ly: hh, lz: 0, index: 8 }, // top-right
    { type: "edge", lx: -hw, ly: hh, lz: 0, index: 9 }, // top-left
    { type: "edge", lx: 0, ly: -hh, lz: hd, index: 10 }, // bottom-front
    { type: "edge", lx: 0, ly: -hh, lz: -hd, index: 11 }, // bottom-back
    { type: "edge", lx: hw, ly: -hh, lz: 0, index: 12 }, // bottom-right
    { type: "edge", lx: -hw, ly: -hh, lz: 0, index: 13 }, // bottom-left
    { type: "edge", lx: hw, ly: 0, lz: hd, index: 14 }, // front-right
    { type: "edge", lx: -hw, ly: 0, lz: hd, index: 15 }, // front-left
    { type: "edge", lx: hw, ly: 0, lz: -hd, index: 16 }, // back-right
    { type: "edge", lx: -hw, ly: 0, lz: -hd, index: 17 }, // back-left
  ];
}

/**
 * World position (in mm) of an anchor on a given object.
 * The object's mesh center is at (position_x, position_y + height/2, position_z),
 * so anchor offsets are relative to that center.
 */
export function anchorWorldPos(
  obj: FurnitureObject,
  anchor: SnapAnchor,
): { x: number; y: number; z: number } {
  const ry = obj.rotation_y ?? 0;
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);

  // Rotate local (lx, lz) around Y by rotation_y, relative to mesh center.
  const rotatedLx = anchor.lx * cosY - anchor.lz * sinY;
  const rotatedLz = anchor.lx * sinY + anchor.lz * cosY;

  return {
    x: obj.position_x + rotatedLx,
    y: obj.position_y + obj.height / 2 + anchor.ly,
    z: obj.position_z + rotatedLz,
  };
}

/**
 * Computes the new position_x/y/z for `source` so that `sourceAnchor`
 * coincides with `targetAnchor` on `target`.
 */
export function computeSnapPosition(
  source: FurnitureObject,
  sourceAnchor: SnapAnchor,
  target: FurnitureObject,
  targetAnchor: SnapAnchor,
): { position_x: number; position_y: number; position_z: number } {
  const src = anchorWorldPos(source, sourceAnchor);
  const tgt = anchorWorldPos(target, targetAnchor);
  return {
    position_x: source.position_x + (tgt.x - src.x),
    position_y: source.position_y + (tgt.y - src.y),
    position_z: source.position_z + (tgt.z - src.z),
  };
}
