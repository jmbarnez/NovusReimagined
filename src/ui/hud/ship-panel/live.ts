import { getState } from "../../../state-access.js";
import { SHIPS } from "../../../data/ships.js";
import { MODULES, MODULE_FLAGS } from "../../../data/modules.js";
import { getHardpointRack, getHardpointSlotCount } from "../../../utils/hardpoints.js";
import { WEAPON_PROFILES } from "../../../data/weaponProfiles.js";
import { getInstance } from "../../../utils/items.js";

import { targetByLockId } from "../../../targeting.js";
import { getStats, getWeaponProfileForSlot } from "../../../player/player-stats.js";
import { isOpen } from "../windows.js";
import { t } from "../../../utils/i18n.js";
import { getIonBoostModuleState } from "../../../player/boost-module.js";
import { C } from "../../../config/index.js";
import {
  activeShipTab,
  lastCurHp,
  lastCurStruct,
  lastCurShield,
  lastCurEnergy,
  setLastCurHp,
  setLastCurStruct,
  setLastCurShield,
  setLastCurEnergy,
  turretCardNodes,
  TurretCardRefs
} from "./state.js";
import { getElement, setText, setStyle } from "../../dom-helpers.js";

/** Caches dynamic element targets for efficient live-checking */
export function cacheTurretCardRefs() {
  turretCardNodes.clear();
  const ship = SHIPS[getState().player.shipId];
  if (!ship) return;
  const numHardpoints = getHardpointSlotCount(ship);
  for (let idx = 0; idx < numHardpoints; idx++) {
    const cardEl = getElement(`sp-turret-card-${idx}`);
    if (!cardEl || cardEl.classList.contains("empty")) continue;

    const powerPill = getElement(`sptc-pill-${idx}`)!;
    const cooldownFill = getElement(`sptc-cd-fill-${idx}`)!;
    const cooldownVal = getElement(`sptc-cd-val-${idx}`)!;
    const heatFill = getElement(`sptc-heat-fill-${idx}`)!;
    const heatVal = getElement(`sptc-heat-val-${idx}`)!;
    const durabilityFill = getElement(`sptc-dur-fill-${idx}`)!;
    const durabilityVal = getElement(`sptc-dur-val-${idx}`)!;
    const targetVal = getElement(`sptc-target-${idx}`)!;

    turretCardNodes.set(idx, {
      cardEl,
      powerPill,
      cooldownFill,
      cooldownVal,
      heatFill,
      heatVal,
      durabilityFill,
      durabilityVal,
      targetVal,
      lastPower: "",
      lastCooldownPct: "",
      lastCooldownText: "",
      lastHeatPct: "",
      lastHeatDanger: false,
      lastDurabilityPct: "",
      lastDurabilityCls: "",
      lastTargetName: "__INITIAL__",
      lastSelected: false,
      lastOverheat: false,
    });
  }
}

/** Updates volatile stat cells and turret bars dynamically using dirty-checks */
export function updateShipPanelLive() {
  if (!isOpen("cargo") || activeShipTab !== "stats") return;

  const p = getState().player;
  const st = getStats(p);

  // 1. Stat cell values
  const hpEl = getElement("sp-cur-hp");
  const structEl = getElement("sp-cur-struct");
  const shieldEl = getElement("sp-cur-shield");
  const energyEl = getElement("sp-cur-energy");
  const boostModuleEl = getElement("sp-cur-boost-module");
  const boostStatsEl = getElement("sp-cur-boost-stats");
  const boostCapEl = getElement("sp-cur-boost-cap");

  const curHp = Math.floor(p.hp);
  const curStruct = Math.floor(p.structure);
  const curShield = Math.floor(p.shield);
  const curEnergy = Math.floor(p.energy);

  if (hpEl && lastCurHp !== curHp) {
    setText(hpEl, String(curHp));
    const bar = getElement("sp-bar-hp");
    if (bar) setStyle(bar, { width: `${Math.max(0, Math.min(1, curHp / Math.max(1, st.maxHp))) * 100}%` });
    setLastCurHp(curHp);
  }
  if (structEl && lastCurStruct !== curStruct) {
    setText(structEl, String(curStruct));
    const bar = getElement("sp-bar-struct");
    if (bar) setStyle(bar, { width: `${Math.max(0, Math.min(1, curStruct / Math.max(1, st.maxStructure))) * 100}%` });
    setLastCurStruct(curStruct);
  }
  if (shieldEl && lastCurShield !== curShield) {
    setText(shieldEl, String(curShield));
    const bar = getElement("sp-bar-shield");
    if (bar) setStyle(bar, { width: `${Math.max(0, Math.min(1, curShield / Math.max(1, st.maxShield))) * 100}%` });
    setLastCurShield(curShield);
  }
  if (energyEl && lastCurEnergy !== curEnergy) {
    setText(energyEl, String(curEnergy));
    const bar = getElement("sp-bar-energy");
    if (bar) setStyle(bar, { width: `${Math.max(0, Math.min(1, curEnergy / Math.max(1, st.maxEnergy))) * 100}%` });
    setLastCurEnergy(curEnergy);
  }
  if (boostModuleEl) {
    const boostModule = getIonBoostModuleState(p);
    const boostText = boostModule.online ? t("ship.online") : t("ship.offline");
    if (boostModuleEl.textContent !== boostText) setText(boostModuleEl, boostText);
    if (boostStatsEl) {
      const boostThrust = C.PHYSICS.SHIP.boostBaseThrustMult
        + (boostModule.online ? C.PHYSICS.SHIP.boostModuleThrustBonus : 0);
      const boostSpeed = C.PHYSICS.SHIP.boostBaseSpeedMult
        + (boostModule.online ? C.PHYSICS.SHIP.boostModuleSpeedBonus : 0);
      const boostStatsText = `${boostThrust.toFixed(2)}x / ${boostSpeed.toFixed(2)}x`;
      if (boostStatsEl.textContent !== boostStatsText) setText(boostStatsEl, boostStatsText);
    }
    if (boostCapEl) {
      const boostCap = C.PHYSICS.SHIP.boostCapDrainPerSec
        * (boostModule.online ? C.PHYSICS.SHIP.boostModuleCapCostMult : 1);
      const boostCapText = `${boostCap.toFixed(1)} GJ/s`;
      if (boostCapEl.textContent !== boostCapText) setText(boostCapEl, boostCapText);
    }
  }

  // 2. Turret grids states
  turretCardNodes.forEach((nodes, idx) => {
    const hpRack = getHardpointRack(p.shipId);
    const uid = p.fitting[hpRack][idx];
    const inst = uid ? getInstance(uid, p) : null;
    const m = inst ? MODULES[inst.baseId] : null;
    if (!inst || !m) return;

    // Status pill
    const durPct = Math.round((inst.durability / inst.maxDurability) * 100);
    const modOffline = durPct <= 0;
    const modDamaged = durPct < 100 && durPct > 0;

    let statusText = t("ship.online");
    let statusCls = "tc-pill online";
    if (modOffline) {
      statusText = t("ship.offline");
      statusCls = "tc-pill offline";
    } else if (modDamaged) {
      statusText = t("ship.damagedAbbr");
      statusCls = "tc-pill damaged";
    }

    if (nodes.lastPower !== statusText) {
      setText(nodes.powerPill, statusText);
      nodes.powerPill.className = statusCls;
      nodes.lastPower = statusText;
    }

    // Cooldown
    const isWeaponTurret = inst.baseId && m.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
    const prof = getWeaponProfileForSlot(idx, p) ?? WEAPON_PROFILES[inst.baseId] ?? WEAPON_PROFILES.default;

    let cdPct = 0;
    let cdText = t("ship.ready");

    if (isWeaponTurret) {
      const cdVal = p.turretCds?.[idx] || 0;
      if (cdVal > 0 && prof.rate > 0) {
        const pct = Math.max(0, Math.min(1, cdVal / prof.rate));
        cdPct = 1 - pct;
        cdText = `${Math.round(cdPct * 100)}%`;
      }
    }

    const cdPctStr = `${cdPct * 100}%`;
    if (nodes.lastCooldownPct !== cdPctStr) {
      setStyle(nodes.cooldownFill, { width: cdPctStr });
      nodes.lastCooldownPct = cdPctStr;
    }
    if (nodes.lastCooldownText !== cdText) {
      setText(nodes.cooldownVal, cdText);
      nodes.lastCooldownText = cdText;
    }

    // Heat & Overheat Animations
    const heat = p.slotHeat?.[hpRack]?.[idx] || 0;
    const heatPctStr = `${Math.min(1, heat) * 100}%`;
    const heatText = `${Math.round(heat * 100)}%`;
    const heatDanger = heat > 0.82;

    if (nodes.lastHeatPct !== heatPctStr) {
      setStyle(nodes.heatFill, { width: heatPctStr });
      setText(nodes.heatVal, heatText);
      nodes.lastHeatPct = heatPctStr;
    }

    const overheat = heatDanger && !modDamaged && !modOffline;

    if (nodes.lastHeatDanger !== heatDanger) {
      nodes.heatFill.className = `tc-bar-fill heat${heatDanger ? " danger" : ""}`;
      nodes.lastHeatDanger = heatDanger;
    }

    if (nodes.lastOverheat !== overheat) {
      if (overheat) {
        nodes.cardEl.classList.add("overheat");
      } else {
        nodes.cardEl.classList.remove("overheat");
      }
      nodes.lastOverheat = overheat;
    }

    // Durability
    const durPctStr = `${durPct}%`;
    let durCls = "tc-bar-fill durability";
    if (modOffline) {
      durCls = "tc-bar-fill durability offline";
    } else if (modDamaged) {
      durCls = "tc-bar-fill durability damaged";
    }

    if (nodes.lastDurabilityPct !== durPctStr) {
      setStyle(nodes.durabilityFill, { width: durPctStr });
      setText(nodes.durabilityVal, durPctStr);
      nodes.lastDurabilityPct = durPctStr;
    }

    if (nodes.lastDurabilityCls !== durCls) {
      nodes.durabilityFill.className = durCls;
      nodes.lastDurabilityCls = durCls;
    }

    // Lock Targeting Info
    const assignedId = p.turretTargets?.[idx] ?? null;
    let targetText = "";
    if (assignedId != null) {
      const targetObj = targetByLockId(assignedId, p);
      targetText = targetObj ? `→ ${targetObj.name || t("ship.targetAssign").slice(2)}` : t("ship.lockAssign");
    }

    if (nodes.lastTargetName !== targetText) {
      setText(nodes.targetVal, targetText);
      nodes.lastTargetName = targetText;
    }

    // Selected slot highlights
    const isSelected = idx === p.fireControlSlot;
    if (nodes.lastSelected !== isSelected) {
      if (isSelected) {
        nodes.cardEl.classList.add("turret-selected");
      } else {
        nodes.cardEl.classList.remove("turret-selected");
      }
      nodes.lastSelected = isSelected;
    }
  });
}
