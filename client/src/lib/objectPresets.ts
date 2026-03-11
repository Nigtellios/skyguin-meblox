export type ObjectPreset = {
  label: string;
  width: number;
  height: number;
  depth: number;
  name: string;
};

export const OBJECT_PRESETS: ObjectPreset[] = [
  {
    label: "Bok 720×600×18",
    width: 18,
    height: 720,
    depth: 600,
    name: "Bok korpusu",
  },
  {
    label: "Półka 600×30×580",
    width: 600,
    height: 30,
    depth: 580,
    name: "Półka",
  },
  {
    label: "Dno 600×18×580",
    width: 600,
    height: 18,
    depth: 580,
    name: "Dno korpusu",
  },
  {
    label: "Front 200×720×18",
    width: 200,
    height: 720,
    depth: 18,
    name: "Front",
  },
  {
    label: "Blat 800×38×600",
    width: 800,
    height: 38,
    depth: 600,
    name: "Blat",
  },
];

export const OBJECT_COLOR_PALETTE = [
  "#8B7355",
  "#C4A882",
  "#F5DEB3",
  "#D2B48C",
  "#A0522D",
  "#6B3F28",
  "#2F4F4F",
  "#556B2F",
  "#FFFFFF",
  "#C0C0C0",
  "#808080",
  "#303030",
  "#4169E1",
  "#DC143C",
  "#228B22",
  "#FF8C00",
] as const;
