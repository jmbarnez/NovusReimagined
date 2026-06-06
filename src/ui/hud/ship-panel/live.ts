import { getState } from "../../../state-access.js";
import { SHIPS } from "../../../data/ships.js";
import { MODULES, MODULE_FLAGS } from "../../../data/modules.js";
import { getHardpointRack, getHardpointSlotCount } from "../../../utils/hardpoints.js";
import { WEAPON_PROFILES } from "../../../data/weaponProfiles.js";
import { getInstance } from "../../../utils/items.js";
import { TURRET_POWER_CYCLE_S } from "../../../constants.js";
import { targetByLockId } from "../../../targeting.js";
import { getStats, getWeaponProfileForSlot } from "../../../player/player-stats.js";
import { isOpen } from "../windows.js";
import { t } from "../../../utils/i18n.js";
import { hasOnlineAfterburnerCoupler, thermalAfterburnerBoostBonus } from "../../../player/thermal-afterburner.js";
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

/** Caches dynamic element targets for efficient live-checking */
export function cacheTurretCardRefs() {
  turretCardNodes.clear();
  const ship = SHIPS[getState().player.shipId];
  if (!ship) return;
  const numHardpoints = getHardpointSlotCount(ship);
  for (let idx = 0; idx < numHardpoints; idx++) {
    const cardEl = document.getElementById(`sp-turret-card-${idx}`);
    if (!cardEl || cardEl.classList.contains("empty")) continue;

    const powerPill = document.getElementById(`sptc-pill-${idx}`)!;
    const cooldownFill = document.getElementById(`sptc-cd-fill-${idx}`)!;
    const cooldownVal = document.getElementById(`sptc-cd-val-${idx}`)!;
    const heatFill = document.getElementById(`sptc-heat-fill-${idx}`)!;
    const heatVal = document.getElementById(`sptc-heat-val-${idx}`)!;
    const durabilityFill = document.getElementById(`sptc-dur-fill-${idx}`)!;
    const durabilityVal = document.getElementById(`sptc-dur-val-${idx}`)!;
    const targetVal = document.getElementById(`sptc-target-${idx}`)!;

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
  const hpEl = document.getElementById("sp-cur-hp");
  const structEl = document.getElementById("sp-cur-struct");
  const shieldEl = document.getElementById("sp-cur-shield");
  const energyEl = document.getElementById("sp-cur-energy");
  const heatEl = document.getElementById("sp-cur-heat");
  const afterburnerCouplingEl = document.getElementById("sp-cur-ab-coupling");
  const thermalBonusEl = document.getElementById("sp-cur-thermal-bonus");

  const curHp = Math.floor(p.hp);
  const curStruct = Math.floor(p.structure);
  const curShield = Math.floor(p.shield);
  const curEnergy = Math.floor(p.energy);

  if (hpEl && lastCurHp !== curHp) {
    hpEl.textContent = String(curHp);
    const bar = document.getElementById("sp-bar-hp");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curHp / Math.max(1, st.maxHp))) * 100}%`;
    setLastCurHp(curHp);
  }
  if (structEl && lastCurStruct !== curStruct) {
    structEl.textContent = String(curStruct);
    const bar = document.getElementById("sp-bar-struct");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curStruct / Math.max(1, st.maxStructure))) * 100}%`;
    setLastCurStruct(curStruct);
  }
  if (shieldEl && lastCurShield !== curShield) {
    shieldEl.textContent = String(curShield);
    const bar = document.getElementById("sp-bar-shield");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curShield / Math.max(1, st.maxShield))) * 100}%`;
    setLastCurShield(curShield);
  }
  if (energyEl && lastCurEnergy !== curEnergy) {
    energyEl.textContent = String(curEnergy);
    const bar = document.getElementById("sp-bar-energy");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curEnergy / Math.max(1, st.maxEnergy))) * 100}%`;
    setLastCurEnergy(curEnergy);
  }
  if (heatEl) {
    const heatPct = Math.round(Math.max(0, Math.min(1, p.shipHeat ?? 0)) * 100);
    const heatText = String(heatPct);
    if (heatEl.textContent !== heatText) heatEl.textContent = heatText;
    const bar = document.getElementById("sp-bar-heat");
    if (bar) bar.style.width = `${heatPct}%`;
  }
  const afterburnerOnline = hasOnlineAfterburnerCoupler(p);
  if (afterburnerCouplingEl) {
    const couplingText = afterburnerOnline ? t("ship.online") : t("ship.offline");
    if (afterburnerCouplingEl.textContent !== couplingText) afterburnerCouplingEl.textContent = couplingText;
  }
  if (thermalBonusEl) {
    const thermalBoost = thermalAfterburnerBoostBonus(p.shipHeat ?? 0, afterburnerOnline);
    const bonusText = `+${Math.round((thermalBoost.thrustBonus + thermalBoost.speedBonus) * 100)}%`;
    if (thermalBonusEl.textContent !== bonusText) thermalBonusEl.textContent = bonusText;
  }

  // 2. Turret grids states
  turretCardNodes.forEach((nodes, idx) => {
    const hpRack = getHardpointRack(p.shipId);
    const uid = p.fitting[hpRack][idx];
    const inst = uid ? getInstance(uid, p) : null;
    const m = inst ? MODULES[inst.baseId] : null;
    if (!inst || !m) return;

    // Power
    const isPowered = p.turretPower?.[idx] ?? false;
    const powerCd = p.turretPowerCd?.[idx] || 0;

    let powerText = t("ship.offline");
    let powerCls = "tc-pill offline";
    if (powerCd > 0) {
      powerText = isPowered ? t("ship.pwrDown") : t("ship.pwrUp");
      powerCls = "tc-pill cycling";
    } else if (isPowered) {
      powerText = t("ship.online");
      powerCls = "tc-pill online";
    }

    const durPct = Math.round((inst.durability / inst.maxDurability) * 100);
    if (durPct <= 0) {
      powerText = t("ship.offline");
      powerCls = "tc-pill offline";
    }

    if (nodes.lastPower !== powerText) {
      nodes.powerPill.textContent = powerText;
      nodes.powerPill.className = powerCls;
      nodes.lastPower = powerText;
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
    
    // Cycle delay
    if (powerCd > 0) {
      const pct = Math.max(0, Math.min(1, powerCd / TURRET_POWER_CYCLE_S));
      cdPct = 1 - pct;
      cdText = `${Math.round(cdPct * 100)}%`;
    }

    const cdPctStr = `${cdPct * 100}%`;
    if (nodes.lastCooldownPct !== cdPctStr) {
      nodes.cooldownFill.style.width = cdPctStr;
      nodes.lastCooldownPct = cdPctStr;
    }
    if (nodes.lastCooldownText !== cdText) {
      nodes.cooldownVal.textContent = cdText;
      nodes.lastCooldownText = cdText;
    }

    // Heat & Overheat Animations
    const heat = p.slotHeat?.[hpRack]?.[idx] || 0;
    const heatPctStr = `${Math.min(1, heat) * 100}%`;
    const heatText = `${Math.round(heat * 100)}%`;
    const heatDanger = heat > 0.82;

    if (nodes.lastHeatPct !== heatPctStr) {
      nodes.heatFill.style.width = heatPctStr;
      nodes.heatVal.textContent = heatText;
      nodes.lastHeatPct = heatPctStr;
    }

    const modOffline = durPct <= 0;
    const modDamaged = durPct < 100 && durPct > 0;
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
      nodes.durabilityFill.style.width = durPctStr;
      nodes.durabilityVal.textContent = durPctStr;
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
      nodes.targetVal.textContent = targetText;
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
