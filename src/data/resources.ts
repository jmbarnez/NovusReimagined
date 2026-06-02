export interface ResourceDef {
  label: string;
  color: string;
  abbr: string;
  icon?: "shard" | "box" | "bolt" | "chip" | "cell" | "gear" | "plate" | "canister";
}

export const ORE: Record<string, ResourceDef> = {
  iron:    { label: "Ferro-chunks",      color: "#a0a5aa", abbr: "Fe", icon: "shard" },
  nickel:  { label: "Nickel-bearing ore", color: "#b9c6bf", abbr: "Ni", icon: "shard" },
  silicate:{ label: "Silicate rubble",    color: "#c7b58a", abbr: "Si", icon: "shard" },
  carbon:  { label: "Carbonaceous ore",   color: "#6f7880", abbr: "C", icon: "shard" },
  crystal: { label: "Lattice crystal",   color: "#44ccff", abbr: "Lc", icon: "shard" },
  exotic:  { label: "Exotic particulate", color: "#ff44aa", abbr: "Ex", icon: "shard" },
};

export const REFINED: Record<string, ResourceDef> = {
  bar:        { label: "Refined ferro bar", abbr: "Bar", color: "#d0d5da", icon: "plate" },
  lattice:    { label: "Lattice ingot",     abbr: "Ing", color: "#88eeff", icon: "box" },
  condensate: { label: "Exotic condensate", abbr: "Con", color: "#ff88dd", icon: "canister" },
};

export const LOOT: Record<string, ResourceDef> = {
  scrap:         { label: "Alloy scrap",     abbr: "Sc", color: "#8899aa", icon: "bolt" },
  chip:          { label: "Data chip",       abbr: "Dp", color: "#55ffaa", icon: "chip" },
  cell:          { label: "Power cell",      abbr: "Ce", color: "#ffff66", icon: "cell" },
  "intact-part": { label: "Intact Component", abbr: "IC", color: "#ffcc88", icon: "box" },
};

export const COMPONENTS: Record<string, ResourceDef> = {
  circuit:        { label: "Circuit board",   abbr: "Cir",  color: "#44ff88", icon: "chip" },
  gear:           { label: "Mechanical gear", abbr: "Gear", color: "#bbbbbb", icon: "gear" },
  harness:        { label: "Wiring harness",  abbr: "Har",  color: "#ffaa66", icon: "bolt" },
  sensor_cluster: { label: "Sensor cluster",  abbr: "Sen",  color: "#66ccff", icon: "box" },
};

export const VOL = {
  ore: { iron: 0.15, nickel: 0.14, silicate: 0.18, carbon: 0.11, crystal: 0.12, exotic: 0.08 },
  refined: { bar: 0.2, lattice: 0.16, condensate: 0.12 },
  loot: { scrap: 0.3, chip: 0.01, cell: 0.05, "intact-part": 0.08 },
  component: { circuit: 0.12, gear: 0.14, harness: 0.13, sensor_cluster: 0.18 },
} as const;
