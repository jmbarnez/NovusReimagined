import { getState } from "../../../state-access.js";
import { MODULES, MODULE_FLAGS } from "../../../data/modules.js";
import { getHardpointRack } from "../../../utils/hardpoints.js";
import { WEAPON_PROFILES } from "../../../data/weaponProfiles.js";
import { RARITY_CONFIG } from "../../../data/moduleRarity.js";
import { getInstance } from "../../../utils/items.js";
import { getWeaponProfileForSlot } from "../../../player/player-stats.js";
import { t } from "../../../utils/i18n.js";
import { escHtml } from "../../../utils/format.js";
import { weaponDeliveryLabel, damageTypeLabel } from "./utils.js";

/** Compiles HTML representation of a single turret slot card */
export function renderTurretCard(idx: number): string {
  const hpRack = getHardpointRack(getState().player.shipId);
  const uid = getState().player.fitting[hpRack][idx];
  const inst = uid ? getInstance(uid, getState().player) : null;
  const m = inst ? MODULES[inst.baseId] : null;

  if (!m || !inst) {
    return `
      <div class="sp-turret-card empty" id="sp-turret-card-${idx}">
        ${t("ship.emptyTurret", { idx: idx + 1 })}
      </div>
    `;
  }

  const rarityCfg = RARITY_CONFIG[inst.rarity || "Stock"] || { color: "#ffffff" };
  const optimal = m.optimalRange ? `${m.optimalRange} km` : "—";
  const falloff = m.falloff ? ` +${m.falloff} km` : "";
  const tracking = m.trackingSpeed != null ? `${Math.round(m.trackingSpeed * 100)}%` : "—";
  const projSpeed = m.projectileKmPerTick ? `${(m.projectileKmPerTick * 60).toFixed(0)} km/s` : "—";

  const isMining = MODULE_FLAGS.isMiningTurret(m) || m.mining;
  const isSalvager = m.isSalvager;

  let specRows = "";
  if (isMining) {
    const rangeBonus = m.effects?.miningRangePctBonus ? `+${Math.round(m.effects.miningRangePctBonus * 100)}%` : "";
    const yieldBonus = m.effects?.miningMultBonus ? `+${Math.round(m.effects.miningMultBonus * 100)}%` : "";
    specRows = `
      <div class="tc-row"><span class="tc-label">${t("ship.type")}</span><span class="tc-val">${t("ship.miningLaser")}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.miningRange")}</span><span class="tc-val">${optimal}</span></div>
      ${yieldBonus ? `<div class="tc-row"><span class="tc-label">${t("ship.yieldBonus")}</span><span class="tc-val">${yieldBonus}</span></div>` : ""}
      ${rangeBonus ? `<div class="tc-row"><span class="tc-label">${t("ship.rangeBonus")}</span><span class="tc-val">${rangeBonus}</span></div>` : ""}
    `;
  } else if (isSalvager) {
    const salvBonus = m.salvageRollBonus ? `+${Math.round(m.salvageRollBonus * 100)}%` : "";
    specRows = `
      <div class="tc-row"><span class="tc-label">${t("ship.type")}</span><span class="tc-val">${t("ship.salvager")}</span></div>
      ${salvBonus ? `<div class="tc-row"><span class="tc-label">${t("ship.salvageBonus")}</span><span class="tc-val">${salvBonus}</span></div>` : ""}
    `;
  } else {
    const prof = getWeaponProfileForSlot(idx, getState().player) ?? WEAPON_PROFILES[inst.baseId] ?? WEAPON_PROFILES.default;
    const dmgParts = damageTypeLabel(m.damageProfile);
    const ammoLeft = prof.ammoType ? (getState().player.ammo[prof.ammoType] || 0) : 0;
    const ammoText = prof.ammoType ? `${prof.ammoType} (${ammoLeft})` : "—";
    
    specRows = `
      <div class="tc-row"><span class="tc-label">${t("ship.type")}</span><span class="tc-val">${weaponDeliveryLabel(m)}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.damage")}</span><span class="tc-val">${dmgParts || "—"}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.optimalRangeStat")}</span><span class="tc-val">${optimal}${falloff}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.trackingSpeed")}</span><span class="tc-val">${tracking}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.projSpeed")}</span><span class="tc-val">${projSpeed}</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.rof")}</span><span class="tc-val">${prof.rate.toFixed(2)} s</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.capShot")}</span><span class="tc-val">${prof.ec.toFixed(1)} GJ</span></div>
      <div class="tc-row"><span class="tc-label">${t("ship.ammoSlot")}</span><span class="tc-val">${ammoText}</span></div>
    `;
  }

  const specs = `
    <div class="tc-row"><span class="tc-label">${t("ship.powergrid")}</span><span class="tc-val">${m.powergrid || 0} PG</span></div>
    <div class="tc-row"><span class="tc-label">${t("ship.cpuLoad")}</span><span class="tc-val">${m.cpu || 0} CPU</span></div>
    <div class="tc-row"><span class="tc-label">${t("inventory.mass")}</span><span class="tc-val">${(m.massKg || 0).toLocaleString()} kg</span></div>
  `;

  return `
    <div class="sp-turret-card" id="sp-turret-card-${idx}">
      <div class="tc-header">
        <div class="tc-title" style="color: ${rarityCfg.color}">${escHtml(inst.rarity || "Stock")} ${escHtml(m.name)}</div>
        <div class="tc-slot-lbl">T${idx + 1}</div>
      </div>
      <div class="tc-state-row">
        <span class="tc-pill" id="sptc-pill-${idx}">${t("ship.offline")}</span>
        <span class="tc-target-val" id="sptc-target-${idx}"></span>
      </div>
      <div class="tc-body">
        ${specRows}
        ${specs}
      </div>
      <div class="tc-progress-section">
        <div class="tc-bar-row">
          <span class="tc-bar-label">${t("ship.cooldown")}</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill cooldown" id="sptc-cd-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-cd-val-${idx}">${t("ship.ready")}</span>
        </div>
        <div class="tc-bar-row">
          <span class="tc-bar-label">${t("ship.heat")}</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill heat" id="sptc-heat-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-heat-val-${idx}">0%</span>
        </div>
        <div class="tc-bar-row">
          <span class="tc-bar-label">${t("ship.durability")}</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill durability" id="sptc-dur-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-dur-val-${idx}">100%</span>
        </div>
      </div>
    </div>
  `;
}
