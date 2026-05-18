/**
 * Regional market — buy orders (credits). Sell flow remains in `station.js` (batch sell).
 */

import { getModule, ModuleDef } from "./modules.js";

export const ORE_MARKET_BUY: Record<string, number> = {
  iron: 8,
  crystal: 18,
  exotic: 32,
};

export const COMPONENT_MARKET_BUY: Record<string, number> = {
  circuit: 240,
  gear: 280,
  harness: 320,
  sensor_cluster: 520,
};

export const ORE_MARKET_BLURB: Record<string, string> = {
  iron: "Unrefined ferro ore — industry input.",
  crystal: "Lattice-bearing raw crystal.",
  exotic: "Rare exotic particulate feedstock.",
};

export const COMPONENT_MARKET_BLURB: Record<string, string> = {
  circuit: "Printed boards for advanced fits & industry.",
  gear: "Precision mechanical assemblies.",
  harness: "Shielded power & data harnesses.",
  sensor_cluster: "Integrated sensor package — advanced fits & builds.",
};

export const BLUEPRINT_MARKET_BUY: Record<string, number> = {
  sensor_cluster: 850,
};

export const BLUEPRINT_MARKET_BLURB: Record<string, string> = {
  sensor_cluster: "Fabrication license — Sensor cluster (Industry Workbench).",
};

export const MODULE_BLUEPRINT_MARKET_BUY: Record<string, number> = {};

export const MODULE_BLUEPRINT_MARKET_BLURB: Record<string, string> = {};

export interface ModuleBlueprintOffer {
  price: number;
  blurb: string;
  mod: ModuleDef;
}

export function getModuleBlueprintOffer(moduleId: string): ModuleBlueprintOffer | null {
  const mod = getModule(moduleId);
  if (!mod) return null;
  const price =
    MODULE_BLUEPRINT_MARKET_BUY[moduleId] ??
    Math.max(350, Math.floor(mod.price * 0.32));
  const blurb =
    MODULE_BLUEPRINT_MARKET_BLURB[moduleId] ??
    `Fitting license — ${mod.name}. Required before you can buy this module unit.`;
  return { price, blurb, mod };
}
