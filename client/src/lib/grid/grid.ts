export type GridUnit = "mm" | "cm";
export type GridAxisKey = "sizeX" | "sizeY" | "sizeZ";

export type GridPreset = {
  label: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
};

export const GRID_PRESETS: GridPreset[] = [
  { label: "10mm", sizeX: 10, sizeY: 10, sizeZ: 10 },
  { label: "50mm", sizeX: 50, sizeY: 50, sizeZ: 50 },
  { label: "100mm", sizeX: 100, sizeY: 100, sizeZ: 100 },
  { label: "200mm", sizeX: 200, sizeY: 200, sizeZ: 200 },
  { label: "500mm", sizeX: 500, sizeY: 500, sizeZ: 500 },
  { label: "1cm", sizeX: 10, sizeY: 10, sizeZ: 10 },
];

export function displayGridValue(valueInMillimetres: number, unit: GridUnit) {
  return unit === "cm" ? valueInMillimetres / 10 : valueInMillimetres;
}

export function normalizeGridInput(inputValue: number, unit: GridUnit) {
  return unit === "cm" ? inputValue * 10 : inputValue;
}
