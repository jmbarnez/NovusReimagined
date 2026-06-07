import type { RefiningHeatMode } from "../state.js";

export interface AlloyFamily {
  id: string;
  label: string;
  densityKgPerM3: number;
  purpose: string;
  windows: Partial<Record<string, { min: number; max: number }>>;
  traceLimit?: number;
  tags?: string[];
}

const ORE_DENSITY_KG_PER_M3: Record<string, number> = {
  iron: 7850,
  nickel: 8900,
  silicate: 2600,
  carbon: 2100,
  crystal: 3200,
  exotic: 5400,
};

export const HEAT_EFFICIENCY: Record<RefiningHeatMode, { process: number; separate: number; alloy: number; tolerance: number }> = {
  cool: { process: 0.94, separate: 0.95, alloy: 0.92, tolerance: 0.02 },
  stable: { process: 1.0, separate: 1.0, alloy: 1.0, tolerance: 0.06 },
  hot: { process: 1.03, separate: 0.91, alloy: 1.04, tolerance: 0.03 },
};

export const ALLOY_FAMILIES: AlloyFamily[] = [
  {
    id: "ferro_nickel_stock",
    label: "Ferro-nickel stock",
    densityKgPerM3: 8150,
    purpose: "Structural frames",
    tags: ["structural", "frame", "gear"],
    traceLimit: 0.12,
    windows: {
      iron: { min: 0.46, max: 0.74 },
      nickel: { min: 0.18, max: 0.42 },
      carbon: { min: 0.0, max: 0.12 },
      silicate: { min: 0.0, max: 0.14 },
      crystal: { min: 0.0, max: 0.08 },
      exotic: { min: 0.0, max: 0.05 },
    },
  },
  {
    id: "carbon_steel_stock",
    label: "Carbon steel stock",
    densityKgPerM3: 7820,
    purpose: "Hull plating",
    tags: ["structural", "hull", "plate"],
    traceLimit: 0.1,
    windows: {
      iron: { min: 0.55, max: 0.84 },
      carbon: { min: 0.08, max: 0.24 },
      nickel: { min: 0.0, max: 0.16 },
      silicate: { min: 0.0, max: 0.12 },
      crystal: { min: 0.0, max: 0.05 },
      exotic: { min: 0.0, max: 0.04 },
    },
  },
  {
    id: "crystal_matrix",
    label: "Crystal matrix stock",
    densityKgPerM3: 3650,
    purpose: "Sensor and lattice assemblies",
    tags: ["sensor", "lattice", "electronics"],
    traceLimit: 0.12,
    windows: {
      crystal: { min: 0.44, max: 0.76 },
      silicate: { min: 0.12, max: 0.34 },
      nickel: { min: 0.0, max: 0.16 },
      iron: { min: 0.0, max: 0.18 },
      exotic: { min: 0.0, max: 0.12 },
      carbon: { min: 0.0, max: 0.08 },
    },
  },
  {
    id: "exotic_conductive",
    label: "Exotic conductive blend",
    densityKgPerM3: 4720,
    purpose: "Power and guidance hardware",
    tags: ["conductive", "power", "guidance"],
    traceLimit: 0.14,
    windows: {
      exotic: { min: 0.18, max: 0.44 },
      crystal: { min: 0.18, max: 0.42 },
      nickel: { min: 0.05, max: 0.26 },
      iron: { min: 0.0, max: 0.18 },
      carbon: { min: 0.0, max: 0.1 },
      silicate: { min: 0.0, max: 0.12 },
    },
  },
];

export function oreDensityKgPerM3(key: string): number {
  return ORE_DENSITY_KG_PER_M3[key] ?? 4000;
}
