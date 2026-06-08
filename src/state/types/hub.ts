import type { BulkMaterialStack } from "./materials.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import type { WreckSalvageEntry } from "../../types/world.js";

export interface HubDepositItem {
  id: string;
  kind: "asteroid" | "debris" | "mixedOreCargo";
  label: string;
  mass: number;
  composition?: Record<string, number>;
  richness?: number;
  qty?: number;
  salvagePool?: WreckSalvageEntry[];
}

export interface HubDeposit {
  raw: HubDepositItem[];
  ore: Record<string, number>;
  materials: BulkMaterialStack[];
  loot: Record<string, number>;
  modules: ModuleInstance[];
}

export interface HubJob {
  id: string;
  kind: "asteroid" | "debris" | "processMixed" | "separateStock" | "alloyStock";
  startTime: number;
  duration: number;
  mass: number;
  composition?: Record<string, number>;
  richness?: number;
  salvagePool?: WreckSalvageEntry[];
  sourceMaterialId?: string;
  targetAlloyFamilyId?: string;
  heatMode?: import("./materials.js").RefiningHeatMode;
  sourceQty?: number;
  sourceStorageId?: string;
  targetStorageId?: string;
  sourceMaterialIds?: string[];
}

export interface HubOutput {
  loot: Record<string, number>;
  ore: Record<string, number>;
  materials: BulkMaterialStack[];
  modules: ModuleInstance[];
}
