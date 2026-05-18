import "../styles/hud-slots.css";
import { G } from "../../state.js";
import { SHIPS } from "../../data/ships.js";
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

/* ── Module Slots ── */
export function updateSlots(ship: any, st: any, now: number) {
  const ft = ship.fitting;
  const nSlots = (ft.turret | 0) + (ft.high | 0) + (ft.med | 0) + (ft.low | 0);
  const stateKey = `${nSlots}|${G.P._assignTargetId ?? "-"}`;

  // Rebuild slots if ship/fitting changed
  if (stateKey !== hudState.lastSlotState) {
    hudState.lastSlotState = stateKey;
    rebuildSlots(ship);
  }

  // Update each slot
  let hkIdx = 0;
  for (const rack of RACK_ORDER) {
    const count = ft[rack] | 0;
    for (let idx = 0; idx < count; idx++) {
      const key = `${rack}|${idx}`;
      const node = hudState.slotNodes.get(key);
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

  const checkSlot = (r: string, i: number) => {
    if (!(G.P.fitting as any)[r]?.[i]) return;
    count++;
    const power = r === "turret" ? (G.P.turretPower?.[i] ?? false) : ((G.P.slotActive as any)?.[r]?.[i] ?? true);
    if (power) allOff = false;
    else allOn = false;
  };

  if (rack === "global") {
    for (const r of RACK_ORDER) {
      const n = (G.P.fitting as any)[r]?.length || 0;
      for (let i = 0; i < n; i++) checkSlot(r, i);
    }
  } else {
    const n = (G.P.fitting as any)[rack]?.length || 0;
    for (let i = 0; i < n; i++) checkSlot(rack, i);
  }

  if (count === 0) return "off";
  if (allOn) return "on";
  if (allOff) return "off";
  return "partial";
}

export function rebuildSlots(ship: any) {
  if (!hudState.slotsContainer) return;
  hudState.slotsContainer.innerHTML = "";
  hudState.slotNodes.clear();
  hudState.rackSwitchNodes.clear();

  const ft = ship.fitting;

  // Global master switch
  const globalSwitch = createRackSwitch("global", "ALL");
  hudState.slotsContainer.appendChild(globalSwitch);
  hudState.rackSwitchNodes.set("global", globalSwitch);

  let hkIdx = 0;
  for (const rack of RACK_ORDER) {
    const count = ft[rack] | 0;
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
      if (rack === "turret") {
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

export function updateSlotNode(node: any, rack: string, idx: number, hkIdx: number, st: any, now: number) {
  const { el, muzzleEl, cdOverlay, heatFill, subEl, nameEl } = node;
  const uid = (G.P.fitting as any)[rack][idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  const pending = G.P._assignTargetId != null;

  const isTurret = rack === "turret";
  const ownPower = isTurret ? (G.P.turretPower?.[idx] ?? false) : ((G.P.slotActive as any)?.[rack]?.[idx] ?? true);
  const isPowered = ownPower;
  const powerCd = isTurret ? (G.P.turretPowerCd?.[idx] || 0) : 0;
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

  if (isTurret && idx === (G.P.fireControlSlot ?? 0)) cls += " turret-selected";

  const assignedId = isTurret
    ? (G.P.turretTargets?.[idx] ?? null)
    : (rack === "high" && m?.isSalvager ? (G.P.highTargets?.[idx] ?? null) : null);
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

  // Heat / module HP bar (dirty-check)
  const heat = (G.P.slotHeat as any)?.[rack]?.[idx] || 0;
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
    const cdVal = G.P.turretCds?.[idx] || 0;
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
    subText = "OFFLINE";
    subCls = "sl-sub off damage-offline";
  } else if (modDamaged) {
    subText = `DMGD ${durPct}%`;
    subCls = "sl-sub damaged";
  } else if (isTurret && powerCd > 0) {
    subText = isPowered ? "PWR DN..." : "PWR UP...";
    subCls = "sl-sub cycling";
  } else if (isTurret && !isPowered) {
    subText = "OFFLINE";
    subCls = "sl-sub off";
  } else if (isWeaponTurret) {
    const prof = WEAPON_PROFILES[inst!.baseId] || WEAPON_PROFILES.default;
    const cdVal = G.P.turretCds?.[idx] || 0;
    let cdStr = "RDY";
    if (cdVal > 0 && prof.rate > 0) {
      const r = Math.round((1 - cdVal / prof.rate) * 100);
      cdStr = `${Math.max(0, Math.min(100, r))}%`;
    }
    if (assignedId != null) {
      const t = targetByLockId(assignedId);
      subText = `→${t ? (t.name || "").slice(0, 3) : "?"} ${cdStr}`;
      subCls = "sl-sub assigned";
    } else {
      subText = `${prof.rate.toFixed(2)}s H${Math.round(heat * 100)} ${cdStr}`;
    }
  } else if (m) {
    subText = isSlotActive ? "ON" : "OFF";
    subCls = isSlotActive ? "sl-sub on" : "sl-sub off";
  }
  if (subEl.textContent !== subText) subEl.textContent = subText;
  if (subEl.className !== subCls) subEl.className = subCls;
}

export function createRackSwitch(rack: string, label: string) {
  const el = document.createElement("div");
  el.className = `rack-master-switch ${rack === "global" ? "global" : "rack-" + rack}`;
  el.dataset.rack = rack;
  el.title = rack === "global" ? "All Systems" : `${rack[0].toUpperCase() + rack.slice(1)} Rack`;

  const onBtn = document.createElement("div");
  onBtn.className = "rms-btn rms-on";
  onBtn.textContent = "ON";
  el.appendChild(onBtn);

  const sep = document.createElement("div");
  sep.className = "rms-label";
  sep.textContent = label;
  el.appendChild(sep);

  const offBtn = document.createElement("div");
  offBtn.className = "rms-btn rms-off";
  offBtn.textContent = "OFF";
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
  const uid = (G.P.fitting as any)[rack]?.[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  const node = hudState.slotNodes.get(`${rack}|${idx}`);

  // Shift+click on turret assigns target
  if (rack === "turret" && e.shiftKey) {
    if (!m) return;
    if (G.P._assignTargetId != null) {
      G.P.turretTargets[idx] = G.P._assignTargetId;
      const target = targetByLockId(G.P._assignTargetId);
      floatText(G.P.x, G.P.y - 30, `TURRET → ${target?.name || "TARGET"}`, "#44ffaa");
      G.P._assignTargetId = null;
    } else if (G.P.targetLock) {
      G.P.turretTargets[idx] = G.P.targetLock.id;
      floatText(G.P.x, G.P.y - 30, `${m.short || m.name} → ${G.P.targetLock.name || "TARGET"}`, "#44ffaa");
    }
    return;
  }

  // Shift+click on salvager high slot assigns locked wreck
  if (rack === "high" && e.shiftKey && m?.isSalvager) {
    if (!G.P.highTargets) G.P.highTargets = [];
    if (G.P.targetLock) {
      G.P.highTargets[idx] = G.P.targetLock.id;
      floatText(G.P.x, G.P.y - 30, `${m.short || m.name} → ${G.P.targetLock.name || "WRECK"}`, "#00e8c8");
    } else {
      G.P.highTargets[idx] = null;
      floatText(G.P.x, G.P.y - 30, `${m.short || m.name} UNASSIGNED`, "#ffaa44");
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
  const ship = SHIPS[G.P.shipId];
  if (!ship) return;
  let count = 0;
  for (const rack of RACK_ORDER) {
    const rackCount = ((ship.fitting as any)[rack] as number) | 0;
    if (slotIdx < count + rackCount) {
      const idx = slotIdx - count;
      const node = hudState.slotNodes.get(`${rack}|${idx}`);
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
