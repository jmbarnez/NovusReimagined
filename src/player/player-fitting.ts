import { G } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { MODULES } from "../data/modules.js";
import { invalidate } from "./player-stats.js";
import { enemyByLockId, targetByLockId } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { MODULE_HP_MAX, TURRET_POWER_CYCLE_S, RACK_TYPES } from "../constants.js";
import { emit } from "../events.js";
import { sfxPowerCycle } from "../audio/procedural.js";
import { getInstance } from "../utils/items.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { tryActivate as tryActivateAbility, ABILITY_BY_ID } from "./abilities.js";

export function syncSlotHeat() {
  const p = G.P;
  const s = SHIPS[p.shipId];
  const pull = (n: number, prev: number[] | undefined) => {
    const nn = Math.max(0, n | 0);
    const a = Array(nn).fill(0);
    if (prev && prev.length) for (let i = 0; i < Math.min(nn, prev.length); i++) a[i] = +prev[i] || 0;
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
  });
  PlayerAccess.setTurretTargetsAll(pullNull(s.fitting.turret, p.turretTargets || []));
  PlayerAccess.setTurretCdsAll(pull(s.fitting.turret, p.turretCds || []));
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
  PlayerAccess.setModuleHpAll(moduleHp);
  if (!p.slotActive) PlayerAccess.setSlotActiveAll(slotActive);
}

export function validateFitting() {
  const p = G.P;
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
  const nt = s.fitting.turret || 0;
  if (p.fireControlSlot < 0 || p.fireControlSlot >= nt) p.fireControlSlot = 0;
  syncSlotHeat();
}

export interface BarSlot {
  rack: string;
  idx: number;
}

export function barHotkeySlotList(): BarSlot[] {
  const p = G.P;
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
  toggleSlotDefaultAction(rack, idx);
}

export function toggleSlotDefaultAction(rack: string, idx: number) {
  const instanceId = G.P.fitting[rack]?.[idx];
  const instance = instanceId ? getInstance(instanceId) : null;
  const m = instance ? MODULES[instance.baseId] : null;
  if (!m) return;

  // Ability modules: hotkey fires the attached ability rather than toggling the slot.
  if (m.ability && ABILITY_BY_ID[m.ability]) {
    const r = tryActivateAbility(m.ability);
    if (r === "fired") {
      const def = ABILITY_BY_ID[m.ability];
      floatText(G.P.x, G.P.y - 30, `${def.name.toUpperCase()}`, "#9adfff");
    } else if (r === "cooldown") {
      floatText(G.P.x, G.P.y - 30, `COOLDOWN`, "#ff8844");
    } else if (r === "no-cap") {
      floatText(G.P.x, G.P.y - 30, `NO CAP`, "#ff8844");
    }
    return;
  }

  if (rack === "turret") {
    const cycling = (G.P.turretPowerCd?.[idx] || 0) > 0;
    if (cycling) return;
    PlayerAccess.setTurretPower(idx, !G.P.turretPower[idx]);
    PlayerAccess.setTurretPowerCd(idx, TURRET_POWER_CYCLE_S);
    sfxPowerCycle(G.P.turretPower[idx]);
    floatText(G.P.x, G.P.y - 30, `${m.short || m.name} ${G.P.turretPower[idx] ? "POWERING UP" : "POWERING DOWN"}`, "#88ccff");
  } else {
    const nowActive = !(G.P.slotActive?.[rack]?.[idx] ?? true);
    PlayerAccess.setSlotActive(rack, idx, nowActive);
    invalidate();
    emit("module:toggle", { rack, idx, active: nowActive, moduleId: instanceId! });
    floatText(G.P.x, G.P.y - 30, `${m.short || m.name} ${nowActive ? "ON" : "OFF"}`, nowActive ? "#44ffaa" : "#ff8844");
  }
}

export function toggleRackPower(rack: string, wantOn: boolean, silent: boolean = false) {
  let changed = false;
  if (rack === "turret") {
    const n = G.P.fitting.turret?.length || 0;
    for (let i = 0; i < n; i++) {
      if (G.P.fitting.turret?.[i] && G.P.turretPower?.[i] !== wantOn) {
        const cycling = (G.P.turretPowerCd?.[i] || 0) > 0;
        if (cycling) continue;
        PlayerAccess.setTurretPower(i, wantOn);
        PlayerAccess.setTurretPowerCd(i, TURRET_POWER_CYCLE_S);
        changed = true;
      }
    }
  } else {
    const n = G.P.fitting[rack]?.length || 0;
    for (let i = 0; i < n; i++) {
      if (G.P.fitting[rack]?.[i] && (G.P.slotActive?.[rack]?.[i] ?? true) !== wantOn) {
        PlayerAccess.setSlotActive(rack, i, wantOn);
        changed = true;
      }
    }
  }
  if (changed) {
    if (!silent) {
      sfxPowerCycle(wantOn);
      const rackLabel = rack[0].toUpperCase() + rack.slice(1);
      floatText(G.P.x, G.P.y - 30, `${rackLabel} RACK ${wantOn ? "ONLINE" : "OFFLINE"}`, wantOn ? "#44ffaa" : "#ff8844");
    }
    invalidate();
  }
  return changed;
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
    invalidate();
    floatText(G.P.x, G.P.y - 30, `ALL SYSTEMS ${wantOn ? "ONLINE" : "OFFLINE"}`, wantOn ? "#44ffaa" : "#ff8844");
  }
  return wantOn;
}
