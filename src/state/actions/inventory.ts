import { type Player } from "../../state.js";
import { PlayerAccess, getState } from "../../state-access.js";
import { MODULES } from "../../data/modules.js";
import { MODULE_HP_MAX } from "../../constants.js";
import { getInstance, invalidateInstanceCache } from "../../utils/items.js";
import { syncSlotHeat } from "../../player/player-fitting.js";
import { invalidate } from "../../player/player-stats.js";
import { moduleFitsShipRack } from "../../utils/hardpoints.js";
import type { ActionResponse } from "./economy.js";

function isInstanceFittedElsewhere(instanceId: string, p: Player, except?: { rack: string; slotIdx: number }): boolean {
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting?.[rack] ?? [];
    for (let idx = 0; idx < slots.length; idx++) {
      if (except && rack === except.rack && idx === except.slotIdx) continue;
      if (slots[idx] === instanceId) return true;
    }
  }
  return false;
}

export function fitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, instanceId: string, p: Player = getState().player): ActionResponse {
  if (!instanceId) return { success: false, reason: "No module selected" };
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  if (p.fitting[rack][slotIdx]) return { success: false, reason: "Slot already occupied" };
  const inst = getInstance(instanceId, p);
  if (!inst) return { success: false, reason: "Module instance not found" };
  const m = MODULES[inst.baseId];
  if (!m) return { success: false, reason: "Module base definition not found" };
  if (!moduleFitsShipRack(m.rack, rack)) return { success: false, reason: "Module does not fit this slot" };
  if (isInstanceFittedElsewhere(instanceId, p)) return { success: false, reason: "Module is already fitted" };

  PlayerAccess.setFittingSlot(rack, slotIdx, instanceId, p);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX), p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function unfitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, p: Player = getState().player): ActionResponse {
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  const uid = p.fitting[rack][slotIdx];
  if (!uid) return { success: false, reason: "Slot is empty" };
  const inst = getInstance(uid, p);
  if (!inst) return { success: false, reason: "Module instance not found" };

  const slotHp = p.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  inst.durability = Math.round((slotHp / MODULE_HP_MAX) * inst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, null, p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function swapModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, newInstanceId: string, p: Player = getState().player): ActionResponse {
  if (!newInstanceId) return { success: false, reason: "No module selected" };
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  const newInst = getInstance(newInstanceId, p);
  if (!newInst) return { success: false, reason: "New module instance not found" };
  const newModule = MODULES[newInst.baseId];
  if (!newModule) return { success: false, reason: "New module base definition not found" };
  if (!moduleFitsShipRack(newModule.rack, rack)) return { success: false, reason: "Module does not fit this slot" };
  if (isInstanceFittedElsewhere(newInstanceId, p, { rack, slotIdx })) {
    return { success: false, reason: "Module is already fitted" };
  }

  const oldUid = p.fitting[rack][slotIdx];
  if (!oldUid) return { success: false, reason: "No module to swap from" };
  const oldInst = getInstance(oldUid, p);
  if (!oldInst) return { success: false, reason: "Old module instance not found" };

  const slotHp = p.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  oldInst.durability = Math.round((slotHp / MODULE_HP_MAX) * oldInst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, newInstanceId, p);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((newInst.durability / newInst.maxDurability) * MODULE_HP_MAX), p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function jettisonItemAction(itemId: string, qty: number | null = null, p: Player = getState().player): ActionResponse {
  // Parsing standard IDs like: "ore_iron", "ammo_hybrid", "loot_scrap", "comp_gear", "mod_uid"
  let type = "";
  let key = "";
  if (itemId.startsWith("ore_")) {
    type = "ore";
    key = itemId.replace("ore_", "");
  } else if (itemId.startsWith("ammo_")) {
    type = "ammo";
    key = itemId.replace("ammo_", "");
  } else if (itemId.startsWith("loot_")) {
    type = "loot";
    key = itemId.replace("loot_", "");
  } else if (itemId.startsWith("comp_")) {
    type = "component";
    key = itemId.replace("comp_", "");
  } else if (itemId.startsWith("mod_")) {
    type = "module";
    key = itemId.replace("mod_", "");
  } else if (itemId.startsWith("mat_")) {
    type = "material";
    key = itemId.replace("mat_", "");
  }

  if (!type) return { success: false, reason: "Invalid item ID format" };

  if (type === "ore") {
    const cur = p.ore[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setOre(key, Math.max(0, cur - drop), p);
    return { success: true, label: `${drop}× iron` }; // Generic display, or caller handles
  } else if (type === "ammo") {
    const cur = p.ammo[key as keyof typeof p.ammo] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setAmmo(key as "hybrid" | "missile", Math.max(0, cur - drop), p);
    return { success: true };
  } else if (type === "material") {
    const idx = parseInt(key, 10);
    if (!Number.isFinite(idx) || idx < 0) return { success: false, reason: "Material stack not found" };
    if (!p.bulkMaterialsCargo?.[idx]) return { success: false, reason: "Material stack not found" };
    PlayerAccess.removeBulkMaterial(idx, p);
    invalidate(p);
    return { success: true };
  } else if (type === "loot") {
    const cur = p.loot[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setLoot(key, Math.max(0, cur - drop), p);
    return { success: true };
  } else if (type === "component") {
    const cur = p.components[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setComponents(key, Math.max(0, cur - drop), p);
    return { success: true };
  } else {
    // Module Jettison
    const isFitted = ["turret", "high", "med", "low"].some(r =>
      p.fitting[r]?.includes(key)
    );
    if (isFitted) return { success: false, reason: "Cannot jettison fitted module" };
    const instIdx = p.moduleCargo.findIndex(inst => inst.uid === key);
    if (instIdx === -1) return { success: false, reason: "Module instance not found in cargo" };

    PlayerAccess.removeModuleCargo(instIdx, p);
    invalidateInstanceCache();
    return { success: true };
  }
}
