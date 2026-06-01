
import { PlayerAccess, getState } from "../state-access.js";
import { queueFrameAction } from "../sim/input.js";
import { SHIPS } from "../data/ships.js";
import { MODULES } from "../data/modules.js";
import { invalidate } from "./player-stats.js";
import { enemyByLockId, targetByLockId } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { MODULE_HP_MAX, TURRET_POWER_CYCLE_S, RACK_TYPES } from "../constants.js";
import { emit } from "../events.js";
import { sfxPowerCycle, sfxTurretAssign } from "../audio/procedural.js";
import { getInstance } from "../utils/items.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { tryActivate as tryActivateAbility, ABILITY_BY_ID } from "./abilities.js";
import { playerHardpointRack } from "../utils/hardpoints.js";

export function syncSlotHeat(p: Player = getState().player) {
  const s = SHIPS[p.shipId];
  const hardpointRack = playerHardpointRack(p);
  const hardpointCount = s.fitting[hardpointRack] || 0;
  const pull = (n: number, prev: number[] | undefined) => {
    const nn = Math.max(0, n | 0);
    const a = Array(nn).fill(0);
    if (prev && prev.length) for (let i = 0; i < Math.min(nn, prev.length); i++) a[i] = +prev[i] || 0;
    return a;
  };
  const pullBool = (n: number, prev: boolean[] | undefined) => {
    const nn = Math.max(0, n | 0);
    const a = Array(nn).fill(false);
    if (prev && prev.length) for (let i = 0; i < Math.min(nn, prev.length); i++) a[i] = !!prev[i];
    return a;
  };
  const pullNull = (n: number, prev: (string | null)[] | undefined) => {
    const nn = Math.max(0, n | 0);
    const a = Array(nn).fill(null);
    if (prev && prev.length) for (let i = 0; i < Math.min(nn, prev.length); i++) a[i] = prev[i] ?? null;
    return a;
  };
  PlayerAccess.setSlotHeatAll({
    turret: pull(s.fitting.turret, p.slotHeat?.turret),
    high: pull(s.fitting.high, p.slotHeat?.high),
    med: pull(s.fitting.med, p.slotHeat?.med),
    low: pull(s.fitting.low, p.slotHeat?.low),
  }, p);
  PlayerAccess.setTurretTargetsAll(pullNull(hardpointCount, p.turretTargets || []), p);
  PlayerAccess.setTurretCdsAll(pull(hardpointCount, p.turretCds || []), p);
  PlayerAccess.setTurretPowerAll(pullBool(hardpointCount, p.turretPower || []), p);
  PlayerAccess.setTurretPowerCdAll(pull(hardpointCount, p.turretPowerCd || []), p);
  const moduleHp: Record<string, (number | null)[]> = p.moduleHp ? { ...p.moduleHp } : { turret: [], high: [], med: [], low: [] };
  const slotActive: Record<string, boolean[]> = p.slotActive ? { ...p.slotActive } : { turret: [], high: [], med: [], low: [] };
  for (const rack of RACK_TYPES) {
    const n = Math.max(0, s.fitting[rack] | 0);
    const prev = moduleHp[rack] || [];
    const a: (number | null)[] = Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (i < prev.length && prev[i] != null) {
        a[i] = prev[i];
      }
      if (p.fitting[rack]?.[i] && a[i] == null) {
        a[i] = MODULE_HP_MAX;
      }
    }
    moduleHp[rack] = a;
  }
  PlayerAccess.setModuleHpAll(moduleHp, p);
  if (!p.slotActive) PlayerAccess.setSlotActiveAll(slotActive, p);
}

export function validateFitting(p: Player = getState().player) {
  const s = SHIPS[p.shipId];
  for (const r of RACK_TYPES) {
    const n = s.fitting[r] || 0;
    if (!Array.isArray(p.fitting[r])) p.fitting[r] = Array(n).fill(null);
    while (p.fitting[r].length < n) p.fitting[r].push(null);
    while (p.fitting[r].length > n) {
      const idx = p.fitting[r].length - 1;
      const m = p.fitting[r].pop();
      if (m) {
        const hp = p.moduleHp?.[r]?.[idx] ?? MODULE_HP_MAX;
        const inst = getInstance(m);
        if (inst) inst.durability = hp;
      }
    }
  }
  const nt = s.fitting[playerHardpointRack(p)] || 0;
  if (p.fireControlSlot < 0 || p.fireControlSlot >= nt) p.fireControlSlot = 0;
  syncSlotHeat(p);
}

export interface BarSlot {
  rack: string;
  idx: number;
}

export function barHotkeySlotList(): BarSlot[] {
  const p = getState().player;
  const s = SHIPS[p.shipId];
  const o: BarSlot[] = [];
  for (let i = 0; i < (s.fitting.turret | 0); i++) o.push({ rack: "turret", idx: i });
  for (let i = 0; i < (s.fitting.high | 0); i++) o.push({ rack: "high", idx: i });
  for (let i = 0; i < (s.fitting.med | 0); i++) o.push({ rack: "med", idx: i });
  for (let i = 0; i < (s.fitting.low | 0); i++) o.push({ rack: "low", idx: i });
  return o;
}

export function applyBarHotkey(keyIndex: number) {
  const slots = barHotkeySlotList();
  if (keyIndex < 0 || keyIndex >= slots.length) return;
  const { rack, idx } = slots[keyIndex];
  const hardpointRack = playerHardpointRack(getState().player);
  if (rack === hardpointRack) {
    if (!(getState().player.turretPower?.[idx] ?? false)) {
      queueFrameAction({ type: "toggleSlotDefaultAction", payload: { rack: hardpointRack, idx } });
    }
    queueFrameAction({ type: "setFireControlSlot", payload: { slot: idx } });
    const assignTargetId = getState().player._assignTargetId;
    if (assignTargetId != null) {
      queueFrameAction({ type: "assignModuleSlotToTarget", payload: { slotIdx: idx, targetId: assignTargetId } });
      queueFrameAction({ type: "selectLockTarget", payload: { id: assignTargetId } });
      sfxTurretAssign();
    }
    return;
  }

  queueFrameAction({ type: "toggleSlotDefaultAction", payload: { rack, idx } });
}

import type { Player } from "../state.js";

export function toggleSlotDefaultAction(rack: string, idx: number, p: Player = getState().player) {
  const instanceId = p.fitting[rack]?.[idx];
  const instance = instanceId ? getInstance(instanceId, p) : null;
  const m = instance ? MODULES[instance.baseId] : null;
  if (!m) return;

  // Ability modules: hotkey fires the attached ability rather than toggling the slot.
  if (m.ability && ABILITY_BY_ID[m.ability]) {
    if (p === getState().player) {
      const r = tryActivateAbility(m.ability);
      if (r === "fired") {
        const def = ABILITY_BY_ID[m.ability];
        floatText(p.x, p.y - 30, `${def.name.toUpperCase()}`, "#9adfff");
      } else if (r === "cooldown") {
        floatText(p.x, p.y - 30, `COOLDOWN`, "#ff8844");
      } else if (r === "no-cap") {
        floatText(p.x, p.y - 30, `NO CAP`, "#ff8844");
      }
    }
    return;
  }

  if (rack === playerHardpointRack(p)) {
    const cycling = (p.turretPowerCd?.[idx] || 0) > 0;
    if (cycling) return;
    const nowPowered = !(p.turretPower?.[idx] ?? false);
    if (p === getState().player) {
      PlayerAccess.setTurretPower(idx, nowPowered);
      PlayerAccess.setTurretPowerCd(idx, TURRET_POWER_CYCLE_S);
      sfxPowerCycle(nowPowered);
      floatText(p.x, p.y - 30, `${m.short || m.name} ${nowPowered ? "POWERING UP" : "POWERING DOWN"}`, "#88ccff");
    } else {
      p.turretPower[idx] = nowPowered;
      if (!p.turretPowerCd) p.turretPowerCd = [];
      p.turretPowerCd[idx] = TURRET_POWER_CYCLE_S;
    }
  } else {
    const nowActive = !(p.slotActive?.[rack]?.[idx] ?? true);
    if (p === getState().player) {
      PlayerAccess.setSlotActive(rack, idx, nowActive);
      invalidate(p);
      emit("module:toggle", { rack, idx, active: nowActive, moduleId: instanceId! });
      floatText(p.x, p.y - 30, `${m.short || m.name} ${nowActive ? "ON" : "OFF"}`, nowActive ? "#44ffaa" : "#ff8844");
    } else {
      if (!p.slotActive) p.slotActive = {};
      if (!p.slotActive[rack]) p.slotActive[rack] = [];
      p.slotActive[rack][idx] = nowActive;
      invalidate(p);
    }
  }
}

export function toggleRackPower(rack: string, wantOn: boolean, silent: boolean = false) {
  let queued = false;
  const hardpointRack = playerHardpointRack(getState().player);
  if (rack === hardpointRack) {
    const n = getState().player.fitting[hardpointRack]?.length || 0;
    for (let i = 0; i < n; i++) {
      if (getState().player.fitting[hardpointRack]?.[i] && getState().player.turretPower?.[i] !== wantOn) {
        const cycling = (getState().player.turretPowerCd?.[i] || 0) > 0;
        if (cycling) continue;
        queueFrameAction({ type: "toggleSlotDefaultAction", payload: { rack: hardpointRack, idx: i } });
        queued = true;
      }
    }
  } else {
    const n = getState().player.fitting[rack]?.length || 0;
    for (let i = 0; i < n; i++) {
      if (getState().player.fitting[rack]?.[i] && (getState().player.slotActive?.[rack]?.[i] ?? true) !== wantOn) {
        queueFrameAction({ type: "toggleSlotDefaultAction", payload: { rack, idx: i } });
        queued = true;
      }
    }
  }
  if (queued) {
    if (!silent) {
      sfxPowerCycle(wantOn);
      const rackLabel = rack[0].toUpperCase() + rack.slice(1);
      floatText(getState().player.x, getState().player.y - 30, `${rackLabel} RACK ${wantOn ? "ONLINE" : "OFFLINE"}`, wantOn ? "#44ffaa" : "#ff8844");
    }
  }
  return queued;
}

export function toggleGlobalPower(wantOn: boolean) {
  let changed = false;
  for (const r of RACK_TYPES) {
    if (toggleRackPower(r, wantOn, true)) {
      changed = true;
    }
  }
  if (changed) {
    sfxPowerCycle(wantOn);
    floatText(getState().player.x, getState().player.y - 30, `ALL SYSTEMS ${wantOn ? "ONLINE" : "OFFLINE"}`, wantOn ? "#44ffaa" : "#ff8844");
  }
  return wantOn;
}

export const applyToggleSlotMutation = toggleSlotDefaultAction;

/** Replays a slot toggle during prediction reconciliation — same logic, same function. */
export const replayPredictedToggleSlotAction = toggleSlotDefaultAction;
