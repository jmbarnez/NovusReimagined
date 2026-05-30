import type { HiddenSiteFamily } from "../types/world.js";

export interface SiteRewardEntry {
  kind:
    | "ore"
    | "cargo"
    | "salvage"
    | "module"
    | "blackbox"
    | "encrypted_core"
    | "access_key"
    | "blueprint_fragment"
    | "prototype_component";
  weight: number;
  minQty?: number;
  maxQty?: number;
}

export interface SiteTypeDef {
  id: string;
  family: HiddenSiteFamily;
  name: string;
  scanDifficulty: number;
  signatureStrength: number;
  signatureSize: number;
  threatLevel: number;
  hasEncryptedContent: boolean;
  decryptDifficulty?: number;
  /** Minimum Surveying skill level to detect or progress this signature. */
  requiredSurveyLevel?: number;
  rewards: SiteRewardEntry[];
}

export const SITE_TYPES: SiteTypeDef[] = [
  {
    id: "resource-dense-ore",
    family: "resource",
    name: "Dense Ore Pocket",
    scanDifficulty: 0.9,
    signatureStrength: 0.9,
    signatureSize: 1.0,
    threatLevel: 1,
    hasEncryptedContent: false,
    rewards: [
      { kind: "ore", weight: 80, minQty: 20, maxQty: 40 },
      { kind: "cargo", weight: 20, minQty: 1, maxQty: 3 },
    ],
  },
  {
    id: "resource-freight-cluster",
    family: "resource",
    name: "Abandoned Freight Cluster",
    scanDifficulty: 1.0,
    signatureStrength: 0.8,
    signatureSize: 0.9,
    threatLevel: 1,
    hasEncryptedContent: true,
    decryptDifficulty: 0.9,
    rewards: [
      { kind: "cargo", weight: 70, minQty: 2, maxQty: 5 },
      { kind: "ore", weight: 20, minQty: 8, maxQty: 16 },
      { kind: "encrypted_core", weight: 10, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "resource-dead-drop",
    family: "resource",
    name: "Smuggler Dead Drop",
    scanDifficulty: 1.15,
    signatureStrength: 0.7,
    signatureSize: 0.8,
    threatLevel: 2,
    hasEncryptedContent: true,
    decryptDifficulty: 1.1,
    rewards: [
      { kind: "cargo", weight: 60, minQty: 2, maxQty: 4 },
      { kind: "access_key", weight: 20, minQty: 1, maxQty: 1 },
      { kind: "encrypted_core", weight: 20, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "derelict-convoy",
    family: "derelict",
    name: "Broken Convoy Field",
    scanDifficulty: 1.1,
    signatureStrength: 0.85,
    signatureSize: 1.1,
    threatLevel: 2,
    hasEncryptedContent: true,
    decryptDifficulty: 1.0,
    rewards: [
      { kind: "salvage", weight: 65, minQty: 3, maxQty: 7 },
      { kind: "module", weight: 20, minQty: 1, maxQty: 1 },
      { kind: "blackbox", weight: 15, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "derelict-yard",
    family: "derelict",
    name: "Collapsed Salvage Yard",
    scanDifficulty: 1.2,
    signatureStrength: 0.75,
    signatureSize: 1.0,
    threatLevel: 2,
    hasEncryptedContent: true,
    decryptDifficulty: 1.15,
    rewards: [
      { kind: "salvage", weight: 70, minQty: 4, maxQty: 8 },
      { kind: "encrypted_core", weight: 20, minQty: 1, maxQty: 1 },
      { kind: "module", weight: 10, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "derelict-war-wreck",
    family: "derelict",
    name: "Drifting War Wreck",
    scanDifficulty: 1.35,
    signatureStrength: 0.65,
    signatureSize: 0.9,
    threatLevel: 3,
    hasEncryptedContent: true,
    decryptDifficulty: 1.3,
    rewards: [
      { kind: "salvage", weight: 55, minQty: 5, maxQty: 10 },
      { kind: "blackbox", weight: 20, minQty: 1, maxQty: 1 },
      { kind: "encrypted_core", weight: 15, minQty: 1, maxQty: 1 },
      { kind: "module", weight: 10, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "relic-archive",
    family: "relic",
    name: "Sealed Archive Vault",
    scanDifficulty: 1.4,
    signatureStrength: 0.6,
    signatureSize: 0.8,
    threatLevel: 3,
    hasEncryptedContent: true,
    decryptDifficulty: 1.35,
    rewards: [
      { kind: "access_key", weight: 25, minQty: 1, maxQty: 1 },
      { kind: "blueprint_fragment", weight: 50, minQty: 1, maxQty: 1 },
      { kind: "prototype_component", weight: 25, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "relic-relay",
    family: "relic",
    name: "Ancient Relay Husk",
    scanDifficulty: 1.5,
    signatureStrength: 0.55,
    signatureSize: 0.75,
    threatLevel: 3,
    hasEncryptedContent: true,
    decryptDifficulty: 1.45,
    rewards: [
      { kind: "blueprint_fragment", weight: 45, minQty: 1, maxQty: 1 },
      { kind: "access_key", weight: 35, minQty: 1, maxQty: 1 },
      { kind: "prototype_component", weight: 20, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: "relic-cache",
    family: "relic",
    name: "Buried Research Cache",
    scanDifficulty: 1.6,
    signatureStrength: 0.5,
    signatureSize: 0.7,
    threatLevel: 4,
    hasEncryptedContent: true,
    decryptDifficulty: 1.55,
    rewards: [
      { kind: "blueprint_fragment", weight: 40, minQty: 1, maxQty: 1 },
      { kind: "prototype_component", weight: 35, minQty: 1, maxQty: 1 },
      { kind: "access_key", weight: 25, minQty: 1, maxQty: 1 },
    ],
  },
];
