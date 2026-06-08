export type RefiningHeatMode = "cool" | "stable" | "hot";
export type BulkMaterialKind = "processed" | "alloy" | "customBlend";
export type RefineryStorageKind = "intake" | "processed" | "separated" | "alloy";

export interface BulkMaterialStack {
  id: string;
  materialId: string;
  kind: BulkMaterialKind;
  label: string;
  volumeM3: number;
  massKg: number;
  composition: Record<string, number>;
  alloyFamilyId?: string;
}

export interface RefineryStorageUnit {
  id: string;
  label: string;
  kind: RefineryStorageKind;
  capacityM3: number;
  entries: BulkMaterialStack[];
  preferredOreKey?: string;
  notes?: string;
}

export interface DiscoveredAlloy {
  id: string;
  label: string;
  signatureKey: string;
  composition: Record<string, number>;
  densityKgPerM3: number;
  purpose: string;
  tags: string[];
  compatibleFamilyIds: string[];
  discoveredAt: number;
  seenCount: number;
}

export interface AlloyCodex {
  knownFamilyIds: string[];
  discoveries: DiscoveredAlloy[];
}

export interface MixedOreCargo {
  composition: Record<string, number>;
  qty: number;
  name: string;
  richness?: number;
}
