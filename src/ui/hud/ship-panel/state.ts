export interface TurretCardRefs {
  cardEl: HTMLElement;
  powerPill: HTMLElement;
  cooldownFill: HTMLElement;
  cooldownVal: HTMLElement;
  heatFill: HTMLElement;
  heatVal: HTMLElement;
  durabilityFill: HTMLElement;
  durabilityVal: HTMLElement;
  targetVal: HTMLElement;
  lastPower: string;
  lastCooldownPct: string;
  lastCooldownText: string;
  lastHeatPct: string;
  lastHeatDanger: boolean;
  lastDurabilityPct: string;
  lastDurabilityCls: string;
  lastTargetName: string;
  lastSelected: boolean;
  lastOverheat: boolean;
}

export let activeShipTab: "cargo" | "stats" = "cargo";

export function setActiveShipTab(tab: "cargo" | "stats") {
  activeShipTab = tab;
}

export function getActiveShipTab() {
  return activeShipTab;
}

// Dirty check caches for live values
export let lastCurHp = -1;
export let lastCurStruct = -1;
export let lastCurShield = -1;
export let lastCurEnergy = -1;

export function setLastCurHp(v: number) {
  lastCurHp = v;
}

export function setLastCurStruct(v: number) {
  lastCurStruct = v;
}

export function setLastCurShield(v: number) {
  lastCurShield = v;
}

export function setLastCurEnergy(v: number) {
  lastCurEnergy = v;
}

export function resetLiveState() {
  lastCurHp = -1;
  lastCurStruct = -1;
  lastCurShield = -1;
  lastCurEnergy = -1;
}

export const turretCardNodes = new Map<number, TurretCardRefs>();
