import "../styles/hud-slots.css";

import { getState } from "../../state-access.js";
import { t } from "../../utils/i18n.js";
import { queueFrameAction } from "../../sim/input.js";
import { SHIPS, type ShipDef, type ShipFitting } from "../../data/ships.js";
import { MODULES, MODULE_FLAGS } from "../../data/modules.js";
import { WEAPON_PROFILES } from "../../data/weaponProfiles.js";
import { MODULE_HP_MAX, TURRET_POWER_CYCLE_S } from "../../constants.js";
import { hotkeyBadge } from "../../utils/format.js";
import { targetByLockId } from "../../targeting.js";
import { applyBarHotkey } from "../../player/player-fitting.js";
import { floatText } from "../../utils/fx.js";
import { getAbilityState, ABILITY_BY_ID } from "../../player/abilities.js";
import { onTurretContextMenu } from "./turret-menu.js";
import { hudState, RACK_ORDER } from "./state.js";
import { getInstance } from "../../utils/items.js";
import { showSlotTooltip, hideSlotTooltip } from "./slotTooltip.js";
import { iconSvg } from "../station/shared.js";
import type { ComputedStats } from "../../player/player-stats.js";
import { sfxBlip } from "../../audio/procedural.js";
import { playerHardpointRack } from "../../utils/hardpoints.js";
import { getSlotPowerCd, isSlotPoweredOn } from "../../utils/slot-power.js";
import { createElement, append, setHtml, setText, setStyle, toggleClass, onClick, onMouseEnter, onMouseLeave, remove, setCssVar } from "../dom-helpers.js";

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
}

export function rebuildSlots(ship: ShipDef) {
  if (!hudState.slotsContainer) return;
  setHtml(hudState.slotsContainer, "");
  hudState.slotNodes.clear();

  const ft = ship.fitting;

  let hkIdx = 0;
  for (const rack of RACK_ORDER) {
    const count = ft[rack as keyof ShipFitting] | 0;
    if (count === 0) continue;

    // Insert a visual divider before each rack after the first one
    if (hkIdx > 0) {
      const divider = createElement("div", "sl-divider");
      append(hudState.slotsContainer, divider);
    }

    for (let idx = 0; idx < count; idx++) {
      const el = createElement("div", `hud-slot rack-${rack}`);
      el.dataset.rack = rack;
      el.dataset.idx = String(idx);

      const badge = createElement("span", "sl-badge");
      setText(badge, hotkeyBadge(hkIdx));
      append(el, badge);

      const rackLabel = createElement("span", "sl-rack");
      setText(rackLabel, `${rack[0]}${idx + 1}`);
      append(el, rackLabel);

      const name = createElement("div", "sl-name empty");
      setText(name, "—");
      append(el, name);

      const sub = createElement("div", "sl-sub");
      append(el, sub);

      const heatTrack = createElement("div", "sl-heat-track");
      const heatFill = createElement("span", "sl-heat-fill");
      append(heatTrack, heatFill);
      append(el, heatTrack);

      const cdOverlay = createElement("div", "sl-cd-overlay");
      setStyle(cdOverlay, { height: "0%" });
      append(el, cdOverlay);

      const muzzle = createElement("div", "sl-muzzle");
      append(el, muzzle);

      onClick(el, (e) => onSlotClick(e as MouseEvent, rack, idx));
      if (rack === playerHardpointRack(getState().player)) {
        onClick(el, (e) => onTurretContextMenu(e as MouseEvent, rack, idx));
      }
      onMouseEnter(el, (e) => showSlotTooltip(rack, idx, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
      onMouseLeave(el, () => hideSlotTooltip());

      append(hudState.slotsContainer, el);
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
    setHtml(nameEl, nameHtml);
    if (nameEl.className !== "sl-name") nameEl.className = "sl-name";
  } else {
    setText(nameEl, t("common.dash"));
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
      strBtn = createElement("button", "sl-str-toggle") as HTMLButtonElement;
      setText(strBtn, btnText);
      strBtn.title = t("ship.tractorControls");
      append(el, strBtn);

      onClick(strBtn, (ev) => {
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
        setText(strBtn, btnText);
      }
    }
    const tightness = getState().player.tractorTightness ?? 0.5;
    setCssVar(strBtn, "--tightness", String(tightness));
  } else {
    if (strBtn) {
      remove(strBtn);
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
  setStyle(heatFill, { width: barW });
  if (heatFill.className !== barCls) heatFill.className = barCls;
  const overheat = heat > 0.82 && !modDamaged && !modOffline;
  const hasOverheat = el.classList.contains("overheat");
  if (overheat && !hasOverheat) toggleClass(el, "overheat", true);
  else if (!overheat && hasOverheat) toggleClass(el, "overheat", false);

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
  setStyle(cdOverlay, { height: cdH });

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
  setText(subEl, subText);
  if (subEl.className !== subCls) subEl.className = subCls;
}

export function onSlotClick(e: MouseEvent, rack: string, idx: number) {
  const r = rack as "turret" | "high" | "med" | "low";
  const uid = getState().player.fitting[r]?.[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  const node = hudState.slotNodes.get(`${rack}|${idx}`) as SlotNode | undefined;

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
        toggleClass(node.el, "firing", false);
        requestAnimationFrame(() => toggleClass(node.el, "firing", true));
      }
      return;
    }
    count += rackCount;
  }
}
