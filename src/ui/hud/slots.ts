import "../styles/hud-slots.css";

import { getState } from "../../state-access.js";
import { queueFrameAction } from "../../sim/input.js";
import { SHIPS, type ShipDef, type ShipFitting } from "../../data/ships.js";
import { MODULES, MODULE_FLAGS } from "../../data/modules.js";
import { WEAPON_PROFILES } from "../../data/weaponProfiles.js";
import { MODULE_HP_MAX, TURRET_POWER_CYCLE_S } from "../../constants.js";
import { hotkeyBadge } from "../../utils/format.js";
import { targetByLockId } from "../../targeting.js";
import { applyBarHotkey, toggleRackPower, toggleGlobalPower } from "../../player/player-fitting.js";
import { floatText } from "../../utils/fx.js";
import { getAbilityState, ABILITY_BY_ID } from "../../player/abilities.js";
import { onTurretContextMenu } from "./turret-menu.js";
import { hudState, RACK_ORDER } from "./state.js";
import { getInstance } from "../../utils/items.js";
import { showSlotTooltip, hideSlotTooltip } from "./slotTooltip.js";
import { iconSvg } from "../station/shared.js";
import type { ComputedStats } from "../../player/player-stats.js";
import { savePlayer } from "../../player/player-data.js";
import { sfxBlip } from "../../audio/procedural.js";
import { playerHardpointRack } from "../../utils/hardpoints.js";
import { getSlotPowerCd, isSlotPoweredOn } from "../../utils/slot-power.js";
import { t } from "../../utils/i18n.js";

export interface SlotNode {
  el: HTMLElement;
  muzzleEl: HTMLElement;
  cdOverlay: HTMLElement;
  heatFill: HTMLElement;
  subEl: HTMLElement;
  nameEl: HTMLElement;
  hkIdx: number;
}

/* ── Module Slots ── */
export function updateSlots(ship: ShipDef, st: ComputedStats, now: number) {
  const ft = ship.fitting;
  const nSlots = (ft.turret | 0) + (ft.high | 0) + (ft.med | 0) + (ft.low | 0);
  const stateKey = `${nSlots}|${getState().player._assignTargetId ?? "-"}`;

  // Rebuild slots if ship/fitting changed
  if (stateKey !== hudState.lastSlotState) {
    hudState.lastSlotState = stateKey;
    rebuildSlots(ship);
  }

  // Update each slot
  let hkIdx = 0;
  for (const rack of RACK_ORDER) {
    const count = ft[rack as keyof ShipFitting] | 0;
    for (let idx = 0; idx < count; idx++) {
      const key = `${rack}|${idx}`;
      const node = hudState.slotNodes.get(key) as SlotNode | undefined;
      if (!node) continue;
      updateSlotNode(node, rack, idx, hkIdx, st, now);
      hkIdx++;
    }
  }

  // Update rack/global power switches
  for (const rack of [...RACK_ORDER, "global"]) {
    const sw = hudState.rackSwitchNodes.get(rack);
    if (!sw) continue;
    const state = getRackState(rack);
    const cls = `rack-master-switch ${rack === "global" ? "global" : "rack-" + rack} ${state}`;
    if (sw.className !== cls) sw.className = cls;
  }
}

export function getRackState(rack: string): "on" | "off" | "partial" {
  let allOn = true;
  let allOff = true;
  let count = 0;

  const checkSlot = (r: "turret" | "high" | "med" | "low", i: number) => {
    const slots = getState().player.fitting[r];
    if (!slots || !slots[i]) return;
    count++;
    const power = isSlotPoweredOn(r, i, getState().player);
    if (power) allOff = false;
    else allOn = false;
  };

  if (rack === "global") {
    for (const r of RACK_ORDER as ("turret" | "high" | "med" | "low")[]) {
      const slots = getState().player.fitting[r];
      const n = slots ? slots.length : 0;
      for (let i = 0; i < n; i++) checkSlot(r, i);
    }
  } else {
    const r = rack as "turret" | "high" | "med" | "low";
    const slots = getState().player.fitting[r];
    const n = slots ? slots.length : 0;
    for (let i = 0; i < n; i++) checkSlot(r, i);
  }

  if (count === 0) return "off";
  if (allOn) return "on";
  if (allOff) return "off";
  return "partial";
}

export function rebuildSlots(ship: ShipDef) {
  if (!hudState.slotsContainer) return;
  hudState.slotsContainer.innerHTML = "";
  hudState.slotNodes.clear();
  hudState.rackSwitchNodes.clear();

  const ft = ship.fitting;

  // Global master switch
  const globalSwitch = createRackSwitch("global", t("ship.allSystems"));
  hudState.slotsContainer.appendChild(globalSwitch);
  hudState.rackSwitchNodes.set("global", globalSwitch);

  let hkIdx = 0;
  for (const rack of RACK_ORDER) {
    const count = ft[rack as keyof ShipFitting] | 0;
    if (count > 0) {
      const rackSwitch = createRackSwitch(rack, rack[0].toUpperCase());
      hudState.slotsContainer.appendChild(rackSwitch);
      hudState.rackSwitchNodes.set(rack, rackSwitch);
    }
    for (let idx = 0; idx < count; idx++) {
      const el = document.createElement("div");
      el.className = `hud-slot rack-${rack}`;
      el.dataset.rack = rack;
      el.dataset.idx = String(idx);

      const badge = document.createElement("span");
      badge.className = "sl-badge";
      badge.textContent = hotkeyBadge(hkIdx);
      el.appendChild(badge);

      const rackLabel = document.createElement("span");
      rackLabel.className = "sl-rack";
      rackLabel.textContent = `${rack[0]}${idx + 1}`;
      el.appendChild(rackLabel);

      const name = document.createElement("div");
      name.className = "sl-name empty";
      name.textContent = "—";
      el.appendChild(name);

      const sub = document.createElement("div");
      sub.className = "sl-sub";
      el.appendChild(sub);

      const heatTrack = document.createElement("div");
      heatTrack.className = "sl-heat-track";
      const heatFill = document.createElement("span");
      heatFill.className = "sl-heat-fill";
      heatTrack.appendChild(heatFill);
      el.appendChild(heatTrack);

      const cdOverlay = document.createElement("div");
      cdOverlay.className = "sl-cd-overlay";
      cdOverlay.style.height = "0%";
      el.appendChild(cdOverlay);

      const muzzle = document.createElement("div");
      muzzle.className = "sl-muzzle";
      el.appendChild(muzzle);

      el.addEventListener("click", (e) => onSlotClick(e, rack, idx));
      if (rack === playerHardpointRack(getState().player)) {
        el.addEventListener("contextmenu", (e) => onTurretContextMenu(e, rack, idx));
      }
      el.addEventListener("mouseenter", (e) => showSlotTooltip(rack, idx, e.clientX, e.clientY));
      el.addEventListener("mousemove", (e) => showSlotTooltip(rack, idx, e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => hideSlotTooltip());

      hudState.slotsContainer.appendChild(el);
      hudState.slotNodes.set(`${rack}|${idx}`, {
        el, muzzleEl: muzzle, cdOverlay, heatFill, subEl: sub, nameEl: name, hkIdx,
      });
      hkIdx++;
    }
  }
}

export function updateSlotNode(node: SlotNode, rack: string, idx: number, hkIdx: number, st: ComputedStats, now: number) {
  const { el, cdOverlay, heatFill, subEl, nameEl } = node;
  const r = rack as "turret" | "high" | "med" | "low";
  const uid = getState().player.fitting[r]?.[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  const pending = getState().player._assignTargetId != null;

  const isTurret = rack === playerHardpointRack(getState().player);
  const ownPower = isSlotPoweredOn(r, idx, getState().player);
  const isPowered = ownPower;
  const powerCd = getSlotPowerCd(r, idx, getState().player);
  const isSlotActive = isPowered && powerCd <= 0;

  const durPct = inst ? Math.round((inst.durability / inst.maxDurability) * 100) : 100;
  const modDamaged = inst && durPct < 100 && durPct > 0;
  const modOffline = inst && durPct <= 0;

  let cls = `hud-slot rack-${rack}`;
  if (!isSlotActive) cls += " inactive-active";
  if (isSlotActive && !isTurret) cls += " module-on";
  if (isTurret && isPowered && powerCd <= 0) cls += " turret-on";
  if (isTurret && !isPowered && powerCd <= 0) cls += " turret-off";
  if (isTurret && powerCd > 0) cls += " turret-cycling";
  if (modDamaged) cls += " module-damaged";
  if (modOffline) cls += " module-offline";

  if (isTurret && idx === (getState().player.fireControlSlot ?? 0)) cls += " turret-selected";

  const assignedId = isTurret
    ? (getState().player.turretTargets?.[idx] ?? null)
    : (rack === "high" && m?.isSalvager ? (getState().player.highTargets?.[idx] ?? null) : null);
  if (assignedId != null) cls += " target-assigned";

  const canAssign = isTurret && (m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m));
  if (pending && canAssign) cls += " pending-assign";

  if (el.className !== cls) el.className = cls;

  // Name + icon (dirty-check)
  if (m) {
    const iconHtml = iconSvg(m.id, 8);
    const nameHtml = iconHtml + ' ' + (m.short || m.name);
    if (nameEl.innerHTML !== nameHtml) nameEl.innerHTML = nameHtml;
    if (nameEl.className !== "sl-name") nameEl.className = "sl-name";
  } else {
    if (nameEl.textContent !== "—") nameEl.textContent = "—";
    if (nameEl.className !== "sl-name empty") nameEl.className = "sl-name empty";
  }

  // Tractor Beam strength toggle button
  const isTractor = m && MODULE_FLAGS.isTractor(m);
  let strBtn = el.querySelector(".sl-str-toggle") as HTMLButtonElement | null;
  if (isTractor && isSlotActive) {
    const minimized = localStorage.getItem("tractor-dial-minimized") === "true";
    const arrow = minimized ? "▲" : "▼";
    const btnText = `STR ${arrow}`;

    if (!strBtn) {
      strBtn = document.createElement("button");
      strBtn.className = "sl-str-toggle";
      strBtn.textContent = btnText;
      strBtn.title = t("ship.tractorControls");
      el.appendChild(strBtn);

      strBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const isMin = localStorage.getItem("tractor-dial-minimized") === "true";
        if (isMin) {
          localStorage.removeItem("tractor-dial-minimized");
        } else {
          localStorage.setItem("tractor-dial-minimized", "true");
        }

        sfxBlip(isMin ? 1100 : 750, 0.02);
      });
    } else {
      if (strBtn.textContent !== btnText) {
        strBtn.textContent = btnText;
      }
    }
    const tightness = getState().player.tractorTightness ?? 0.5;
    strBtn.style.setProperty("--tightness", String(tightness));
  } else {
    if (strBtn) {
      strBtn.remove();
    }
  }

  // Heat / module HP bar (dirty-check)
  const heat = getState().player.slotHeat?.[r]?.[idx] || 0;
  let barW: string, barCls: string;
  if (modDamaged || modOffline) {
    const hpPct = inst ? inst.durability / inst.maxDurability : 0;
    barW = `${Math.max(0, hpPct) * 100}%`;
    barCls = `sl-heat-fill${modOffline ? " danger" : " damaged"}`;
  } else {
    barW = `${Math.min(1, heat) * 100}%`;
    barCls = `sl-heat-fill${heat > 0.82 ? " danger" : ""}`;
  }
  if (heatFill.style.width !== barW) heatFill.style.width = barW;
  if (heatFill.className !== barCls) heatFill.className = barCls;
  const overheat = heat > 0.82 && !modDamaged && !modOffline;
  const hasOverheat = el.classList.contains("overheat");
  if (overheat && !hasOverheat) el.classList.add("overheat");
  else if (!overheat && hasOverheat) el.classList.remove("overheat");

  // Cooldown overlay (dirty-check) — weapon fire OR power cycle
  const isWeaponTurret = isTurret && inst?.baseId && m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
  let cdH = "0%";
  if (isWeaponTurret) {
    const prof = WEAPON_PROFILES[inst!.baseId] || WEAPON_PROFILES.default;
    const cdVal = getState().player.turretCds?.[idx] || 0;
    if (cdVal > 0 && prof.rate > 0) {
      const pct = Math.max(0, Math.min(1, cdVal / prof.rate));
      cdH = `${pct * 100}%`;
    }
  }
  // Power cycle overlay takes precedence
  if (isTurret && powerCd > 0) {
    const pct = Math.max(0, Math.min(1, powerCd / TURRET_POWER_CYCLE_S));
    cdH = `${pct * 100}%`;
  }
  // Ability module: surface ability cooldown in the slot overlay.
  if (m?.ability && ABILITY_BY_ID[m.ability]) {
    const def = ABILITY_BY_ID[m.ability];
    const ab = getAbilityState(m.ability);
    if (ab.cd > 0 && def.cooldown > 0) {
      const pct = Math.max(0, Math.min(1, ab.cd / def.cooldown));
      cdH = `${pct * 100}%`;
    }
  }
  if (cdOverlay.style.height !== cdH) cdOverlay.style.height = cdH;

  // Subtext (dirty-check)
  let subText = "", subCls = "sl-sub";
  if (modOffline) {
    subText = t("ship.offline");
    subCls = "sl-sub off damage-offline";
  } else if (modDamaged) {
    subText = `${t("ship.damagedAbbr")} ${durPct}%`;
    subCls = "sl-sub damaged";
  } else if (isTurret && powerCd > 0) {
    subText = isPowered ? t("ship.pwrDown") : t("ship.pwrUp");
    subCls = "sl-sub cycling";
  } else if (isTurret && !isPowered) {
    subText = t("ship.offline");
    subCls = "sl-sub off";
  } else if (isWeaponTurret) {
    const prof = WEAPON_PROFILES[inst!.baseId] || WEAPON_PROFILES.default;
    const cdVal = getState().player.turretCds?.[idx] || 0;
    let cdStr = t("ship.ready");
    if (cdVal > 0 && prof.rate > 0) {
      const r = Math.round((1 - cdVal / prof.rate) * 100);
      cdStr = `${Math.max(0, Math.min(100, r))}%`;
    }
    if (assignedId != null) {
      const tgt = targetByLockId(assignedId);
      subText = `→${tgt ? (tgt.name || "").slice(0, 3) : "?"} ${cdStr}`;
      subCls = "sl-sub assigned";
    } else {
      subText = `${prof.rate.toFixed(2)}s ${t("ship.heatAbbr")}${Math.round(heat * 100)} ${cdStr}`;
    }
  } else if (m) {
    subText = isSlotActive ? t("ship.online") : t("ship.offline");
    subCls = isSlotActive ? "sl-sub on" : "sl-sub off";
  }
  if (subEl.textContent !== subText) subEl.textContent = subText;
  if (subEl.className !== subCls) subEl.className = subCls;
}

export function createRackSwitch(rack: string, label: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `rack-master-switch ${rack === "global" ? "global" : "rack-" + rack}`;
  el.dataset.rack = rack;
  el.title = rack === "global" ? t("ship.allSystems") : `${t("inventory.slot" + (rack[0].toUpperCase() + rack.slice(1)))} ${t("ship.rack")}`;

  const onBtn = document.createElement("div");
  onBtn.className = "rms-btn rms-on";
  onBtn.textContent = t("ship.online");
  el.appendChild(onBtn);

  const sep = document.createElement("div");
  sep.className = "rms-label";
  sep.textContent = label;
  el.appendChild(sep);

  const offBtn = document.createElement("div");
  offBtn.className = "rms-btn rms-off";
  offBtn.textContent = t("ship.offline");
  el.appendChild(offBtn);

  el.addEventListener("click", (e) => {
    const rect = el.getBoundingClientRect();
    const wantOn = (e as MouseEvent).clientY < rect.top + rect.height / 2;
    onRackSwitchZoneClick(rack, wantOn);
  });
  return el;
}

export function onRackSwitchZoneClick(rack: string, wantOn: boolean) {
  if (rack === "global") {
    toggleGlobalPower(wantOn);
  } else {
    toggleRackPower(rack, wantOn);
  }
}

export function onSlotClick(e: MouseEvent, rack: string, idx: number) {
  const r = rack as "turret" | "high" | "med" | "low";
  const uid = getState().player.fitting[r]?.[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  const node = hudState.slotNodes.get(`${rack}|${idx}`) as SlotNode | undefined;

  // Shift+click on turret assigns target
  if (rack === playerHardpointRack(getState().player) && e.shiftKey) {
    if (!m) return;
    if (getState().player._assignTargetId != null) {
      const assignTargetId = getState().player._assignTargetId;
      if (!assignTargetId) return;
      queueFrameAction({ type: "assignModuleSlotToTarget", payload: { slotIdx: idx, targetId: assignTargetId } });
      const target = targetByLockId(assignTargetId);
      floatText(getState().player.x, getState().player.y - 30, `TURRET → ${target?.name || t("ship.target")}`, "#44ffaa");
      queueFrameAction({ type: "selectLockTarget", payload: { id: assignTargetId } });
    } else {
      const targetLock = getState().player.targetLock;
      if (!targetLock) return;
      queueFrameAction({ type: "assignModuleSlotToTarget", payload: { slotIdx: idx, targetId: targetLock.id } });
      floatText(getState().player.x, getState().player.y - 30, `${m.short || m.name} → ${targetLock.name || t("ship.target")}`, "#44ffaa");
    }
    return;
  }

  // Shift+click on salvager high slot assigns locked wreck
  if (rack === "high" && e.shiftKey && m?.isSalvager) {
    const targetLock = getState().player.targetLock;
    if (targetLock) {
      queueFrameAction({ type: "setHighTarget", payload: { idx, targetId: targetLock.id } });
      floatText(getState().player.x, getState().player.y - 30, `${m.short || m.name} → ${targetLock.name || t("ship.wreck")}`, "#00e8c8");
    } else {
      queueFrameAction({ type: "setHighTarget", payload: { idx, targetId: null } });
      floatText(getState().player.x, getState().player.y - 30, `${m.short || m.name} ${t("ship.unassigned")}`, "#ffaa44");
    }
    return;
  }

  // Left click on any slot performs its default action (same as hotkey)
  if (node && node.hkIdx !== undefined) {
    applyBarHotkey(node.hkIdx);
  }
}

export function flashSlotFire(slotIdx: number) {
  // slotIdx is the global index across all racks (turret first, then high, etc.)
  // We need to map it back to rack+idx
  const ship = SHIPS[getState().player.shipId];
  if (!ship) return;
  let count = 0;
  for (const rack of RACK_ORDER) {
    const rackCount = (ship.fitting[rack as keyof ShipFitting]) | 0;
    if (slotIdx < count + rackCount) {
      const idx = slotIdx - count;
      const node = hudState.slotNodes.get(`${rack}|${idx}`) as SlotNode | undefined;
      if (node) {
        node.el.classList.remove("firing");
        void node.el.offsetWidth; // force reflow to restart animation
        node.el.classList.add("firing");
      }
      return;
    }
    count += rackCount;
  }
}
