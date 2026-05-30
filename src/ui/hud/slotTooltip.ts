import "../styles/hud-tooltip.css";
import { getState } from "../../state-access.js";
import { MODULES, DamageProfile } from "../../data/modules.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { getInstance } from "../../utils/items.js";
import { fmtModBonuses } from "../station/shared.js";
import { WEAPON_PROFILES } from "../../data/weaponProfiles.js";

const TOOLTIP_EL_ID = "hud-slot-tooltip";

function getTooltipEl(): HTMLElement {
  let el = document.getElementById(TOOLTIP_EL_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOOLTIP_EL_ID;
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtAffixList(affixes: { id: string; name: string; affectedStat: string; value: number }[]): string {
  return affixes.map(a => {
    const v = a.value;
    const pct = Math.abs(v) < 1 ? (v * 100).toFixed(1) + "%" : v.toFixed(1);
    const sign = v >= 0 ? "+" : "";
    return `<span class="tt-affix-pos">${sign}${pct}</span> ${escHtml(a.name)}`;
  }).join("<br>");
}

function rackLabel(rack: string): string {
  return { turret: "Turret Slot", high: "High Slot", med: "Medium Slot", low: "Low Slot" }[rack] || rack;
}

function damageTypeLabel(profile?: DamageProfile | null): string {
  if (!profile) return "";
  const labels: Record<string, string> = { em: "EM", therm: "Thermal", kin: "Kinetic", exp: "Explosive" };
  return Object.entries(profile)
    .filter(([, v]) => v)
    .map(([t, v]) => `${v} ${labels[t] || t}`)
    .join(" / ");
}

export function showSlotTooltip(rack: string, idx: number, mouseX: number, mouseY: number) {
  const uid = getState().player.fitting[rack]?.[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m) return;

  const el = getTooltipEl();
  const rarityCfg = RARITY_CONFIG[inst?.rarity || "Stock"];
  const durPct = inst ? Math.round((inst.durability / inst.maxDurability) * 100) : 100;
  const durColor = durPct > 60 ? "#44ff88" : durPct > 30 ? "#ffcc44" : "#ff4444";
  const durBar = `<div class="tt-dur-bar"><div class="tt-dur-fill" style="width:${durPct}%;background:${durColor}"></div></div>`;

  let combatHtml = "";
  if (m.weaponDelivery) {
    const dmgParts = damageTypeLabel(m.damageProfile);
    const optimal = m.optimalRange ? `${m.optimalRange} km` : "—";
    const falloff = m.falloff ? `+${m.falloff} km` : "";
    const tracking = m.trackingSpeed != null ? `${Math.round(m.trackingSpeed * 100)}%` : "—";
    const projSpeed = m.projectileKmPerTick ? `${(m.projectileKmPerTick * 60).toFixed(0)} km/s` : "—";

    const deliveryLabels: Record<string, string> = {
      projectile: "Projectile",
      beam: "Energy Beam",
      missile: "Guided Missile",
    };

    combatHtml = `
      <div class="tt-section">
        <div class="tt-section-title">Weapon System</div>
        <div class="tt-row"><span class="tt-label">Type</span><span class="tt-val">${deliveryLabels[m.weaponDelivery] || m.weaponDelivery}</span></div>
        ${dmgParts ? `<div class="tt-row"><span class="tt-label">Damage</span><span class="tt-val">${dmgParts}</span></div>` : ""}
        <div class="tt-row"><span class="tt-label">Optimal Range</span><span class="tt-val">${optimal}${falloff ? ` (falloff ${falloff})` : ""}</span></div>
        <div class="tt-row"><span class="tt-label">Tracking Speed</span><span class="tt-val">${tracking}</span></div>
        ${m.projectileKmPerTick ? `<div class="tt-row"><span class="tt-label">Projectile Speed</span><span class="tt-val">${projSpeed}</span></div>` : ""}
      </div>`;
  }

  if (m.mining) {
    const rangeVal = m.optimalRange ? `${m.optimalRange} m` : "";
    const rangeBonus = m.effects?.miningRangePctBonus ? `+${Math.round(m.effects.miningRangePctBonus * 100)}%` : "";
    const yieldBonus = m.effects?.miningMultBonus ? `+${Math.round(m.effects.miningMultBonus * 100)}%` : "";
    combatHtml = `
      <div class="tt-section">
        <div class="tt-section-title">Mining System</div>
        <div class="tt-row"><span class="tt-val" style="color:#88ffcc">Mining Laser</span></div>
        ${rangeVal ? `<div class="tt-row"><span class="tt-label">Optimal Range</span><span class="tt-val">${rangeVal}</span></div>` : ""}
        ${yieldBonus ? `<div class="tt-row"><span class="tt-label">Yield Bonus</span><span class="tt-val">${yieldBonus}</span></div>` : ""}
        ${rangeBonus ? `<div class="tt-row"><span class="tt-label">Range Bonus</span><span class="tt-val">${rangeBonus}</span></div>` : ""}
      </div>`;
  }

  if (m.isSalvager) {
    const salvBonus = m.salvageRollBonus ? `+${Math.round(m.salvageRollBonus * 100)}%` : "";
    combatHtml = `
      <div class="tt-section">
        <div class="tt-section-title">Salvage System</div>
        <div class="tt-row"><span class="tt-val" style="color:#00e8c8">Salvager</span></div>
        ${salvBonus ? `<div class="tt-row"><span class="tt-label">Salvage Bonus</span><span class="tt-val">${salvBonus}</span></div>` : ""}
      </div>`;
  }

  let bonusesHtml = "";
  const bonuses = fmtModBonuses(m);
  if (bonuses) {
    bonusesHtml = `<div class="tt-section"><div class="tt-section-title">Module Bonuses</div><div class="tt-bonuses">${escHtml(bonuses)}</div></div>`;
  }

  let affixHtml = "";
  if (inst && inst.affixes.length > 0) {
    affixHtml = `<div class="tt-section"><div class="tt-section-title">Installed Modifications</div><div class="tt-affixes">${fmtAffixList(inst.affixes)}</div></div>`;
  }

  const isActive = m.isActive ? "Active Module" : "Passive Module";
  const capDrain = m.capDrainPerSec ? `<div class="tt-row"><span class="tt-label">Capacitor Drain</span><span class="tt-val">${m.capDrainPerSec} GJ/s</span></div>` : "";
  const wProf = m.weaponDelivery ? (WEAPON_PROFILES[m.id] || WEAPON_PROFILES.default) : null;
  const capCost = wProf && wProf.ec ? `<div class="tt-row"><span class="tt-label">Activation Cost</span><span class="tt-val">${wProf.ec} GJ</span></div>` : "";

  el.innerHTML = `
    <div class="tt-header">
      <span class="tt-rarity" style="color:${rarityCfg.color}">${escHtml(inst?.rarity || "Stock")}</span>
    </div>
    <div class="tt-name">${escHtml(m.name)}</div>
    <div class="tt-rack-label">${rackLabel(rack)} · ${isActive}</div>

    ${combatHtml}
    ${bonusesHtml}
    ${affixHtml}

    <div class="tt-section">
      <div class="tt-section-title">Module Specifications</div>
      <div class="tt-row"><span class="tt-label">Powergrid</span><span class="tt-val">${m.powergrid} PG</span></div>
      <div class="tt-row"><span class="tt-label">CPU Load</span><span class="tt-val">${m.cpu} CPU</span></div>
      <div class="tt-row"><span class="tt-label">Mass</span><span class="tt-val">${m.massKg.toLocaleString()} kg</span></div>
      ${capDrain}
      ${capCost}
    </div>

    <div class="tt-section">
      <div class="tt-section-title">Condition</div>
      <div class="tt-dur-row">
        <span class="tt-label">Durability</span>
        <span class="tt-dur-pct" style="color:${durColor}">${durPct}%</span>
      </div>
      ${durBar}
    </div>

    ${m.desc ? `<div class="tt-desc">${escHtml(m.desc)}</div>` : ""}
  `;

  el.style.display = "block";
  const rect = el.getBoundingClientRect();
  let left = mouseX + 14;
  let top = mouseY - 10;
  if (left + rect.width > window.innerWidth - 8) left = mouseX - rect.width - 14;
  if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
  if (top < 8) top = 8;
  el.style.left = left + "px";
  el.style.top = top + "px";
}

export function hideSlotTooltip() {
  const el = document.getElementById(TOOLTIP_EL_ID);
  if (el) el.style.display = "none";
}
