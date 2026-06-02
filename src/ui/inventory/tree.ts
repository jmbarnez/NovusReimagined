import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { SHIPS } from "../../data/ships.js";
import { MODULES, MODULE_HOLD_VOLUME_M3 } from "../../data/modules.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { getInstance } from "../../utils/items.js";
import { ORE, REFINED, LOOT, VOL } from "../../data/resources.js";
import { t } from "../../utils/i18n.js";
import { dominantOreKey, formatCompositionBreakdown } from "../../utils/ore-naming.js";
import type { InventoryItem, TreeNode } from "./state.js";

export function getTreeNodes(): TreeNode[] {
  const nodes: TreeNode[] = [];

  nodes.push({
    id: "ship",
    label: `${SHIPS[getState().player.shipId].name} ${t("inventory.cargoAndFit")}`,
    icon: "▸",
    children: [
      { id: "shipCargo", label: t("inventory.cargoHold"), icon: "▦" },
      { id: "shipFitting", label: t("inventory.fitting"), icon: "⚙" },
    ],
  });

  if (Client.stationOpen && Client.activeStation) {
    nodes.push({
      id: "station",
      label: Client.activeStation.name,
      icon: "⌂",
      children: [{ id: "stationStorage", label: t("inventory.itemHangar"), icon: "□" }],
    });
  }

  return nodes;
}

export function normalizeItems(): InventoryItem[] {
  const items: InventoryItem[] = [];
  const p = getState().player;

  const oreGroup = t("inventory.resourceOre");
  const ammoGroup = t("inventory.resourceAmmo");
  const refGroup = t("inventory.resourceRefined");
  const salvageGroup = t("inventory.resourceSalvage");
  const compGroup = t("inventory.resourceComponent");

  for (const [key, qty] of Object.entries(p.ore)) {
    if (qty > 0) {
      items.push({
        id: `ore_${key}`,
        name: ORE[key]?.label ?? `${key} ore`,
        group: oreGroup,
        qty,
        vol: VOL.ore[key as keyof typeof VOL.ore] ?? 0.3,
        type: "ore",
        key,
        container: "shipCargo",
      });
    }
  }

  for (let i = 0; i < (p.mixedOreCargo?.length ?? 0); i++) {
    const slot = p.mixedOreCargo[i];
    if (slot.qty <= 0) continue;
    const dominant = dominantOreKey(slot.composition);
    items.push({
      id: `mixed_ore_${i}`,
      name: slot.name,
      group: `${oreGroup} · ${formatCompositionBreakdown(slot.composition)}`,
      qty: slot.qty,
      vol: VOL.ore[dominant as keyof typeof VOL.ore] ?? 0.3,
      type: "mixedOre",
      key: dominant,
      container: "shipCargo",
      composition: { ...slot.composition },
    });
  }

  if (p.ammo.hybrid > 0) items.push({ id: "ammo_hybrid", name: "Hybrid Charges", group: ammoGroup, qty: p.ammo.hybrid, vol: 0.01, type: "ammo", key: "hybrid", container: "shipCargo" });
  if (p.ammo.missile > 0) items.push({ id: "ammo_missile", name: "Missile Rounds", group: ammoGroup, qty: p.ammo.missile, vol: 0.015, type: "ammo", key: "missile", container: "shipCargo" });

  if (p.refined.bar > 0) items.push({ id: "ref_bar", name: "Refined Bar", group: refGroup, qty: p.refined.bar, vol: 0.5, type: "refined", key: "bar", container: "shipCargo" });
  if (p.refined.lattice > 0) items.push({ id: "ref_lattice", name: "Crystal Lattice", group: refGroup, qty: p.refined.lattice, vol: 0.5, type: "refined", key: "lattice", container: "shipCargo" });
  if (p.refined.condensate > 0) items.push({ id: "ref_condensate", name: "Condensate", group: refGroup, qty: p.refined.condensate, vol: 0.6, type: "refined", key: "condensate", container: "shipCargo" });

  if (p.loot.scrap > 0) items.push({ id: "loot_scrap", name: "Scrap Metal", group: salvageGroup, qty: p.loot.scrap, vol: 0.2, type: "loot", key: "scrap", container: "shipCargo" });
  if (p.loot.chip > 0) items.push({ id: "loot_chip", name: "Circuit Chip", group: salvageGroup, qty: p.loot.chip, vol: 0.05, type: "loot", key: "chip", container: "shipCargo" });
  if (p.loot.cell > 0) items.push({ id: "loot_cell", name: "Power Cell", group: salvageGroup, qty: p.loot.cell, vol: 0.08, type: "loot", key: "cell", container: "shipCargo" });

  for (const [key, qty] of Object.entries(p.components)) {
    if (qty > 0) {
      const nice = key.replace(/_/g, " ");
      items.push({
        id: `comp_${key}`,
        name: nice.charAt(0).toUpperCase() + nice.slice(1),
        group: compGroup,
        qty,
        vol: 0.1,
        type: "component",
        key,
        container: "shipCargo",
      });
    }
  }

  const fittedUids = new Set<string>();
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting[rack];
    if (slots) {
      for (const uid of slots) if (uid) fittedUids.add(uid);
    }
  }

  for (const inst of p.moduleCargo) {
    if (fittedUids.has(inst.uid)) continue;
    const m = MODULES[inst.baseId];
    if (m) {
      const rarityCfg = RARITY_CONFIG[inst.rarity];
      items.push({
        id: `mod_${inst.uid}`,
        name: `${inst.rarity} ${m.name}`,
        group: m.rack ? `${t("inventory.module")} (${m.rack})` : t("inventory.module"),
        qty: 1,
        vol: MODULE_HOLD_VOLUME_M3,
        type: "module",
        key: inst.uid,
        container: "shipCargo",
        meta: m,
        instance: inst,
        rarityColor: rarityCfg.color,
      });
    }
  }

  const rackNames: Record<string, string> = {
    turret: t("inventory.slotTurret"),
    high: t("inventory.slotHigh"),
    med: t("inventory.slotMed"),
    low: t("inventory.slotLow"),
  };

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = getInstance(uid, getState().player);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (!m) continue;
      const rarityCfg = RARITY_CONFIG[inst.rarity];
      items.push({
        id: `fit_${rack}_${i}`,
        name: `${inst.rarity} ${m.name}`,
        group: `${t("inventory.fittedModule")} ${rackNames[rack] || rack}`,
        qty: 1,
        vol: MODULE_HOLD_VOLUME_M3,
        type: "fitting",
        key: `${rack}:${i}`,
        container: "shipFitting",
        meta: m,
        instance: inst,
        rarityColor: rarityCfg.color,
      });
    }
  }

  return items;
}

export function getItemsForContainer(containerId: string): InventoryItem[] {
  const all = normalizeItems();
  if (containerId === "ship") {
    return all.filter((it) => it.container === "shipCargo" || it.container === "shipFitting");
  }
  if (containerId === "station") {
    return all.filter((it) => it.container === "stationStorage");
  }
  return all.filter((it) => it.container === containerId);
}

export function calcVolume(items: InventoryItem[]): number {
  return items.reduce((sum, it) => sum + (it.vol || 0) * (it.qty || 1), 0);
}

export function getCapacityFor(containerId: string): number {
  const ship = SHIPS[getState().player.shipId];
  if (containerId === "ship" || containerId === "shipCargo") return ship.baseCargoM3 || 100;
  if (containerId === "shipFitting") return 0;
  if (containerId === "station" || containerId === "stationStorage") return 10000;
  return 100;
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
