export type MaterialType =
  | "wood"
  | "furniture_board"
  | "veneered_board"
  | "plastic"
  | "steel"
  | "stainless_steel"
  | "aluminum"
  | "unspecified";

export const MATERIAL_TYPES: readonly MaterialType[] = [
  "wood",
  "furniture_board",
  "veneered_board",
  "plastic",
  "steel",
  "stainless_steel",
  "aluminum",
  "unspecified",
] as const;

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  wood: "Drewno",
  furniture_board: "Płyta meblowa",
  veneered_board: "Płyta fornirowana",
  plastic: "Plastik",
  steel: "Stal",
  stainless_steel: "Stal nierdzewna",
  aluminum: "Aluminium",
  unspecified: "Nieokreślony",
};

/**
 * Default colors for each material type.
 * Carefully chosen to resemble real-world materials:
 * - Wood: warm oak brown
 * - Furniture board: light beige laminate
 * - Veneered board: rich walnut
 * - Plastic: clean white
 * - Steel: dark gunmetal gray
 * - Stainless steel: bright silver
 * - Aluminum: light silver-gray
 * - Unspecified: neutral medium gray
 */
export const MATERIAL_DEFAULT_COLORS: Record<MaterialType, string> = {
  wood: "#8B7355",
  furniture_board: "#D4B896",
  veneered_board: "#6B4226",
  plastic: "#E8E8E8",
  steel: "#5A5A6A",
  stainless_steel: "#C0C0C8",
  aluminum: "#A8B0B8",
  unspecified: "#888888",
};

/**
 * Materials that support metallic rendering in Three.js.
 * These use MeshStandardMaterial with metalness and roughness.
 */
export const METALLIC_MATERIALS: ReadonlySet<MaterialType> = new Set([
  "steel",
  "stainless_steel",
  "aluminum",
]);

/**
 * Materials that support edge banding (oklejanie).
 * Plastics, metals, and unspecified materials do not support edge banding.
 */
export const EDGE_BANDING_MATERIALS: ReadonlySet<MaterialType> = new Set([
  "wood",
  "furniture_board",
  "veneered_board",
]);

/**
 * Three.js metalness values for metallic materials.
 * Higher values = more reflective metallic appearance.
 */
export const MATERIAL_METALNESS: Partial<Record<MaterialType, number>> = {
  steel: 0.85,
  stainless_steel: 0.9,
  aluminum: 0.75,
};

/**
 * Three.js roughness values for metallic materials.
 * Lower values = smoother, more mirror-like surface.
 * - Steel: slightly rough, industrial look
 * - Stainless steel: smooth, polished
 * - Aluminum: medium, brushed finish
 */
export const MATERIAL_ROUGHNESS: Partial<Record<MaterialType, number>> = {
  steel: 0.45,
  stainless_steel: 0.25,
  aluminum: 0.35,
};
