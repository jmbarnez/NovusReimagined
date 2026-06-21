/**
 * Basic player resource accessors: credits, ammo, ore, loot, components.
 *
 * These are the flat scalar/bag fields on `Player` that are not part of the
 * cargo, contract, crafting, or refinery-storage subsystems.
 */
import { _G, type Player } from "../../../../state.js";

export const playerResourcesAccess = {
  modifyCredits(amount: number, p: Player = _G.P) {
    p.credits += amount;
  },

  setAmmo(type: "hybrid" | "missile", value: number, p: Player = _G.P) {
    p.ammo[type] = value;
  },

  setOre(type: string, value: number, p: Player = _G.P) {
    p.ore[type] = value;
  },

  setOreAll(ore: Record<string, number>, p: Player = _G.P) {
    p.ore = ore;
  },

  setLoot(type: string, value: number, p: Player = _G.P) {
    p.loot[type] = value;
  },

  setLootAll(loot: Record<string, number>, p: Player = _G.P) {
    p.loot = loot;
  },

  setComponents(type: string, value: number, p: Player = _G.P) {
    p.components[type] = value;
  },

  setComponentsAll(components: Record<string, number>, p: Player = _G.P) {
    p.components = components;
  },

  setAmmoAll(ammo: { hybrid: number; missile: number }, p: Player = _G.P) {
    p.ammo = ammo;
  },
};
