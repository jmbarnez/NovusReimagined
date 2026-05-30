import "../styles/ship-panel.css";
import { getState } from "../../state-access.js";
import { SHIPS } from "../../data/ships.js";
import { MODULES, MODULE_FLAGS, DamageProfile } from "../../data/modules.js";
import { WEAPON_PROFILES } from "../../data/weaponProfiles.js";
import { RARITY_CONFIG } from "../../data/moduleRarity.js";
import { getInstance } from "../../utils/items.js";
import { TURRET_POWER_CYCLE_S } from "../../constants.js";
import { maxTargetLocks, targetByLockId } from "../../targeting.js";
import { getStats, getWeaponProfileForSlot } from "../../player/player-stats.js";
import { sfxBlip } from "../../audio/procedural.js";
import { renderInventoryHTML, attachInventoryListeners } from "../inventory.js";
import { isOpen } from "./windows.js";

// Active tab state
let activeShipTab: "cargo" | "stats" = "cargo";

export function getActiveShipTab() {
  return activeShipTab;
}

// Dirty check caches for live values
let lastCurHp = -1;
let lastCurStruct = -1;
let lastCurShield = -1;
let lastCurEnergy = -1;

interface TurretCardRefs {
  cardEl: HTMLElement;
  powerPill: HTMLElement;
  cooldownFill: HTMLElement;
  cooldownVal: HTMLElement;
  heatFill: HTMLElement;
  heatVal: HTMLElement;
  durabilityFill: HTMLElement;
  durabilityVal: HTMLElement;
  targetVal: HTMLElement;
  lastPower: string;
  lastCooldownPct: string;
  lastCooldownText: string;
  lastHeatPct: string;
  lastHeatDanger: boolean;
  lastDurabilityPct: string;
  lastDurabilityCls: string;
  lastTargetName: string;
  lastSelected: boolean;
  lastOverheat: boolean;
}

const turretCardNodes = new Map<number, TurretCardRefs>();

/** Simple HTML escape function to prevent XSS/broken layouts */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Formats module damage profiles in local context */
function damageTypeLabel(profile?: DamageProfile | null): string {
  if (!profile) return "";
  const labels: Record<string, string> = { em: "EM", therm: "Thermal", kin: "Kinetic", exp: "Explosive" };
  return Object.entries(profile)
    .filter(([, v]) => v)
    .map(([t, v]) => `${v} ${labels[t] || t}`)
    .join(" / ");
}

/** Builds the multi-tab SHIP HUD panel container structure */
export function buildShipPanelShell(): HTMLElement {
  activeShipTab = "cargo";
  lastCurHp = -1;
  lastCurStruct = -1;
  lastCurShield = -1;
  lastCurEnergy = -1;
  turretCardNodes.clear();

  const root = document.createElement("div");
  root.id = "ship-panel-root";
  root.className = "sp-root";
  root.style.height = "100%";
  root.style.width = "100%";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.overflow = "hidden";

  root.innerHTML = `
    <div class="sp-tabs">
      <button class="sp-tab active" data-tab="cargo">Cargo</button>
      <button class="sp-tab"        data-tab="stats">Stats</button>
    </div>
    <div class="sp-body" style="flex:1; min-height:0; position:relative;">
      <div class="sp-tab-panel active" data-tab-panel="cargo">
        <div id="bridge-pane-cargo" class="br-pane" style="height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;">
          ${renderInventoryHTML()}
        </div>
      </div>
      <div class="sp-tab-panel" data-tab-panel="stats">
        <div class="sp-scroll" id="ship-stats-scroll">
          ${renderStatsTabHTML()}
        </div>
      </div>
    </div>
  `;

  return root;
}

/** Attaches click listeners for active tab toggles */
export function attachShipPanelListeners(root: HTMLElement) {
  const tabs = root.querySelectorAll(".sp-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      sfxBlip();
      const targetTab = (tab as HTMLElement).dataset.tab as "cargo" | "stats";
      if (activeShipTab === targetTab) return;

      activeShipTab = targetTab;

      // Toggle tab classes
      tabs.forEach((t) => t.classList.toggle("active", t === tab));

      // Toggle panel panels
      const panels = root.querySelectorAll(".sp-tab-panel");
      panels.forEach((p) => {
        const isTarget = (p as HTMLElement).dataset.tabPanel === targetTab;
        p.classList.toggle("active", isTarget);
      });

      // If switched to Stats, rebuild its static content and cache refs
      if (targetTab === "stats") {
        lastCurHp = -1;
        lastCurStruct = -1;
        lastCurShield = -1;
        lastCurEnergy = -1;
        rebuildStatsTab();
      }
    });
  });
}

/** Triggers full rebuild of the stats display area */
function rebuildStatsTab() {
  const scrollContainer = document.getElementById("ship-stats-scroll");
  if (scrollContainer) {
    scrollContainer.innerHTML = renderStatsTabHTML();
    cacheTurretCardRefs();
  }
}

/** Caches dynamic element targets for efficient live-checking */
function cacheTurretCardRefs() {
  turretCardNodes.clear();
  const ship = SHIPS[getState().player.shipId];
  if (!ship) return;
  const numTurrets = ship.fitting.turret || 0;
  for (let idx = 0; idx < numTurrets; idx++) {
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

/** Compiles HTML representation of stats and sub-cards */
export function renderStatsTabHTML(): string {
  const p = getState().player;
  const st = getStats();
  const ship = SHIPS[p.shipId];

  const card = (lbl: string, val: string | number) => `
    <div class="st-stat-card">
      <span class="lbl">${lbl}</span>
      <span class="val">${val}</span>
    </div>
  `;

  const barCard = (lbl: string, valHtml: string, barCls: string, barId: string, pct: number) => `
    <div class="st-stat-card st-bar-card">
      <div class="st-bar-header">
        <span class="lbl">${lbl}</span>
        <span class="val">${valHtml}</span>
      </div>
      <div class="st-bar-track">
        <span class="st-bar-fill ${barCls}" id="${barId}" style="width: ${pct}%"></span>
      </div>
    </div>
  `;

  // Section 1: Ship Basic
  const shipHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Ship Specifications</div>
      <div class="sp-stats-grid">
        ${card("Name", ship.name)}
        ${card("Role", ship.role)}
        ${card("Signature Radius", `${ship.signatureRadius} m`)}
        ${card("Hull Mass", `${ship.hullMassKg.toLocaleString()} kg`)}
        ${card("Mass Modifier", `${st.massMult.toFixed(2)}x`)}
      </div>
    </div>
  `;

  // Section 2: Defense
  const shieldRegen = st.shieldRegen ? `${st.shieldRegen.toFixed(1)}/s` : "—";
  const emRes = `${Math.round((ship.resistances?.em ?? 0) * 100)}%`;
  const thermRes = `${Math.round((ship.resistances?.therm ?? 0) * 100)}%`;
  const kinRes = `${Math.round((ship.resistances?.kin ?? 0) * 100)}%`;
  const expRes = `${Math.round((ship.resistances?.exp ?? 0) * 100)}%`;

  const shieldPct = Math.max(0, Math.min(1, p.shield / Math.max(1, st.maxShield))) * 100;
  const hpPct = Math.max(0, Math.min(1, p.hp / Math.max(1, st.maxHp))) * 100;
  const structPct = Math.max(0, Math.min(1, p.structure / Math.max(1, st.maxStructure))) * 100;
  const energyPct = Math.max(0, Math.min(1, p.energy / Math.max(1, st.maxEnergy))) * 100;

  const defenseHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Defense & Shield Systems</div>
      <div class="sp-stats-grid">
        ${barCard("Shield Strength", `<span id="sp-cur-shield">${Math.floor(p.shield)}</span> / ${st.maxShield}`, "shield", "sp-bar-shield", shieldPct)}
        ${barCard("Hull Integrity", `<span id="sp-cur-hp">${Math.floor(p.hp)}</span> / ${st.maxHp}`, "hull", "sp-bar-hp", hpPct)}
        ${barCard("Structure", `<span id="sp-cur-struct">${Math.floor(p.structure)}</span> / ${st.maxStructure}`, "struct", "sp-bar-struct", structPct)}
        ${card("Shield Recharge", shieldRegen)}
        ${card("EM Resistance", emRes)}
        ${card("Thermal Resistance", thermRes)}
        ${card("Kinetic Resistance", kinRes)}
        ${card("Explosive Resistance", expRes)}
      </div>
    </div>
  `;

  // Section 3: Capacitor
  const capacitorHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Capacitor & Power Storage</div>
      <div class="sp-stats-grid">
        ${barCard("Capacitor", `<span id="sp-cur-energy">${Math.floor(p.energy)}</span> / ${st.maxEnergy} GJ`, "cap", "sp-bar-energy", energyPct)}
        ${card("Recharge Rate", `${st.energyRegen.toFixed(1)} GJ/s`)}
      </div>
    </div>
  `;

  // Section 4: Propulsion
  const propulsionHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Propulsion & Maneuvering</div>
      <div class="sp-stats-grid">
        ${card("Max Speed", `${st.maxSpeed.toFixed(0)} px/s (base ${st.baseMaxSpeed.toFixed(0)})`)}
        ${card("Main Thrust", `${st.mainThrust.toFixed(0)}`)}
        ${card("Retro Thrust", `${st.retroThrust.toFixed(0)}`)}
        ${card("Lateral Thrust", `${st.lateralThrust.toFixed(0)}`)}
        ${card("Turn Rate", `${st.turnRate.toFixed(2)} rad/s (base ${st.baseTurnRate.toFixed(2)})`)}
        ${card("Agility", `${st.thrustScale.toFixed(2)}x (base ${st.baseThrustScale.toFixed(2)})`)}
        ${card("Drag/Second", `${st.dragPerSec.toFixed(4)}`)}
      </div>
    </div>
  `;

  // Section 5: Sensors
  const sensorsHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Sensors & Targeting</div>
      <div class="sp-stats-grid">
        ${card("Max Targets", maxTargetLocks())}
        ${card("Target Lock Range", `${ship.lockRangeKm} km`)}
        ${card("Sensor Scan Range", `${ship.sensorContactRangeKm} km`)}
        ${card("Lock Scan Modifier", `${st.lockScanMult.toFixed(1)}x`)}
      </div>
    </div>
  `;

  // Section 6: Fitting
  const pgWarn = st.usedPG > st.totalPG ? "overload" : "";
  const powergridVal = `<span class="${pgWarn}">${st.usedPG.toFixed(1)} / ${st.totalPG.toFixed(1)} PG</span>`;

  const fittingHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Fitting Specifications</div>
      <div class="sp-stats-grid">
        ${card("Powergrid", powergridVal)}
        ${card("CPU Load", `${st.usedCPU.toFixed(0)} / ${st.totalCPU.toFixed(0)} CPU`)}
        ${card("Turret Slots", ship.fitting.turret)}
        ${card("High Slots", ship.fitting.high)}
        ${card("Med Slots", ship.fitting.med)}
        ${card("Low Slots", ship.fitting.low)}
        ${card("Cargo Capacity", `${ship.baseCargoM3} m³`)}
      </div>
    </div>
  `;

  // Section 7: Offense / Mining
  const primaryWeaponName = st.weaponTurret?.name ?? "—";
  const ammoDesc = st.wProf.ammoType ? `${st.wProf.ammoType} (${st.wProf.ammoPerShot}/shot)` : "—";
  const mineRangeKm = ship.miningRangeKm ?? 8;

  const offenseHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">Offense & Mining Operations</div>
      <div class="sp-stats-grid">
        ${card("Primary Weapon", primaryWeaponName)}
        ${card("Weapon Damage", st.finalDmg)}
        ${card("Weapon Modifier", `${st.weaponMult.toFixed(2)}x`)}
        ${card("Optimal Weapon Range", `${st.wProf.range} px`)}
        ${card("Weapon Rate of Fire", `${st.wProf.rate.toFixed(2)} s`)}
        ${card("Capacitor per Shot", `${st.wProf.ec.toFixed(1)} GJ`)}
        ${card("Ammo Type", ammoDesc)}
        ${card("Fitted Mining Lasers", st.hasMiner ? "Yes" : "No")}
        ${card("Mining Yield Modifier", `${st.miningMult.toFixed(2)}x`)}
        ${card("Base Mining Range", `${mineRangeKm} km`)}
        ${card("Fitted Salvagers", st.hasSalvager ? "Yes" : "No")}
        ${card("Salvage Bonus", `${Math.round(st.salvageBonus * 100)}%`)}
        ${card("Metallurgy Level", st.metallurgyLevel)}
      </div>
    </div>
  `;

  // Section 8: Turrets Cards
  const numTurrets = ship.fitting.turret || 0;
  let turretsCardsHtml = "";
  for (let idx = 0; idx < numTurrets; idx++) {
    turretsCardsHtml += renderTurretCard(idx);
  }

  const turretsHtml = `
    <div class="sp-sect" style="margin-bottom:0;">
      <div class="sp-sect-h">Turret Fitting Bays</div>
      <div class="sp-turrets-grid">
        ${turretsCardsHtml}
      </div>
    </div>
  `;

  return `
    ${shipHtml}
    ${defenseHtml}
    ${capacitorHtml}
    ${propulsionHtml}
    ${sensorsHtml}
    ${fittingHtml}
    ${offenseHtml}
    ${turretsHtml}
  `;
}

/** Compiles HTML representation of a single turret slot card */
function renderTurretCard(idx: number): string {
  const uid = getState().player.fitting.turret[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;

  if (!m || !inst) {
    return `
      <div class="sp-turret-card empty" id="sp-turret-card-${idx}">
        [ EMPTY TURRET SLOT T${idx + 1} ]
      </div>
    `;
  }

  const rarityCfg = RARITY_CONFIG[inst.rarity || "Stock"] || { color: "#ffffff" };
  const optimal = m.optimalRange ? `${m.optimalRange} km` : "—";
  const falloff = m.falloff ? ` +${m.falloff} km` : "";
  const tracking = m.trackingSpeed != null ? `${Math.round(m.trackingSpeed * 100)}%` : "—";
  const projSpeed = m.projectileKmPerTick ? `${(m.projectileKmPerTick * 60).toFixed(0)} km/s` : "—";

  const deliveryLabels: Record<string, string> = {
    projectile: "Projectile",
    beam: "Energy Beam",
    missile: "Guided Missile",
  };

  const isMining = MODULE_FLAGS.isMiningTurret(m) || m.mining;
  const isSalvager = m.isSalvager;

  let specRows = "";
  if (isMining) {
    const rangeBonus = m.effects?.miningRangePctBonus ? `+${Math.round(m.effects.miningRangePctBonus * 100)}%` : "";
    const yieldBonus = m.effects?.miningMultBonus ? `+${Math.round(m.effects.miningMultBonus * 100)}%` : "";
    specRows = `
      <div class="tc-row"><span class="tc-label">Type</span><span class="tc-val">Mining Laser</span></div>
      <div class="tc-row"><span class="tc-label">Mining Range</span><span class="tc-val">${optimal}</span></div>
      ${yieldBonus ? `<div class="tc-row"><span class="tc-label">Yield Bonus</span><span class="tc-val">${yieldBonus}</span></div>` : ""}
      ${rangeBonus ? `<div class="tc-row"><span class="tc-label">Range Bonus</span><span class="tc-val">${rangeBonus}</span></div>` : ""}
    `;
  } else if (isSalvager) {
    const salvBonus = m.salvageRollBonus ? `+${Math.round(m.salvageRollBonus * 100)}%` : "";
    specRows = `
      <div class="tc-row"><span class="tc-label">Type</span><span class="tc-val">Salvager</span></div>
      ${salvBonus ? `<div class="tc-row"><span class="tc-label">Salvage Bonus</span><span class="tc-val">${salvBonus}</span></div>` : ""}
    `;
  } else {
    const prof = getWeaponProfileForSlot(idx) ?? WEAPON_PROFILES[inst.baseId] ?? WEAPON_PROFILES.default;
    const dmgParts = damageTypeLabel(m.damageProfile);
    const ammoLeft = prof.ammoType ? (getState().player.ammo[prof.ammoType] || 0) : 0;
    const ammoText = prof.ammoType ? `${prof.ammoType} (${ammoLeft})` : "—";
    
    specRows = `
      <div class="tc-row"><span class="tc-label">Type</span><span class="tc-val">${deliveryLabels[m.weaponDelivery || ""] || m.weaponDelivery || "—"}</span></div>
      <div class="tc-row"><span class="tc-label">Damage</span><span class="tc-val">${dmgParts || "—"}</span></div>
      <div class="tc-row"><span class="tc-label">Optimal Range</span><span class="tc-val">${optimal}${falloff}</span></div>
      <div class="tc-row"><span class="tc-label">Tracking Speed</span><span class="tc-val">${tracking}</span></div>
      <div class="tc-row"><span class="tc-label">Projectile Speed</span><span class="tc-val">${projSpeed}</span></div>
      <div class="tc-row"><span class="tc-label">Rate of Fire</span><span class="tc-val">${prof.rate.toFixed(2)} s</span></div>
      <div class="tc-row"><span class="tc-label">Cap/Shot</span><span class="tc-val">${prof.ec.toFixed(1)} GJ</span></div>
      <div class="tc-row"><span class="tc-label">Ammo Slot</span><span class="tc-val">${ammoText}</span></div>
    `;
  }

  const specs = `
    <div class="tc-row"><span class="tc-label">Powergrid</span><span class="tc-val">${m.powergrid || 0} PG</span></div>
    <div class="tc-row"><span class="tc-label">CPU Load</span><span class="tc-val">${m.cpu || 0} CPU</span></div>
    <div class="tc-row"><span class="tc-label">Mass</span><span class="tc-val">${(m.massKg || 0).toLocaleString()} kg</span></div>
  `;

  return `
    <div class="sp-turret-card" id="sp-turret-card-${idx}">
      <div class="tc-header">
        <div class="tc-title" style="color: ${rarityCfg.color}">${escHtml(inst.rarity || "Stock")} ${escHtml(m.name)}</div>
        <div class="tc-slot-lbl">T${idx + 1}</div>
      </div>
      <div class="tc-state-row">
        <span class="tc-pill" id="sptc-pill-${idx}">OFFLINE</span>
        <span class="tc-target-val" id="sptc-target-${idx}"></span>
      </div>
      <div class="tc-body">
        ${specRows}
        ${specs}
      </div>
      <div class="tc-progress-section">
        <div class="tc-bar-row">
          <span class="tc-bar-label">COOLDOWN</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill cooldown" id="sptc-cd-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-cd-val-${idx}">RDY</span>
        </div>
        <div class="tc-bar-row">
          <span class="tc-bar-label">HEAT</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill heat" id="sptc-heat-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-heat-val-${idx}">0%</span>
        </div>
        <div class="tc-bar-row">
          <span class="tc-bar-label">DURABILITY</span>
          <div class="tc-bar-track">
            <span class="tc-bar-fill durability" id="sptc-dur-fill-${idx}"></span>
          </div>
          <span class="tc-bar-val" id="sptc-dur-val-${idx}">100%</span>
        </div>
      </div>
    </div>
  `;
}

/** Updates volatile stat cells and turret bars dynamically using dirty-checks */
export function updateShipPanelLive() {
  if (!isOpen("cargo") || activeShipTab !== "stats") return;

  const p = getState().player;
  const st = getStats();

  // 1. Stat cell values
  const hpEl = document.getElementById("sp-cur-hp");
  const structEl = document.getElementById("sp-cur-struct");
  const shieldEl = document.getElementById("sp-cur-shield");
  const energyEl = document.getElementById("sp-cur-energy");

  const curHp = Math.floor(p.hp);
  const curStruct = Math.floor(p.structure);
  const curShield = Math.floor(p.shield);
  const curEnergy = Math.floor(p.energy);

  if (hpEl && lastCurHp !== curHp) {
    hpEl.textContent = String(curHp);
    const bar = document.getElementById("sp-bar-hp");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curHp / Math.max(1, st.maxHp))) * 100}%`;
    lastCurHp = curHp;
  }
  if (structEl && lastCurStruct !== curStruct) {
    structEl.textContent = String(curStruct);
    const bar = document.getElementById("sp-bar-struct");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curStruct / Math.max(1, st.maxStructure))) * 100}%`;
    lastCurStruct = curStruct;
  }
  if (shieldEl && lastCurShield !== curShield) {
    shieldEl.textContent = String(curShield);
    const bar = document.getElementById("sp-bar-shield");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curShield / Math.max(1, st.maxShield))) * 100}%`;
    lastCurShield = curShield;
  }
  if (energyEl && lastCurEnergy !== curEnergy) {
    energyEl.textContent = String(curEnergy);
    const bar = document.getElementById("sp-bar-energy");
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, curEnergy / Math.max(1, st.maxEnergy))) * 100}%`;
    lastCurEnergy = curEnergy;
  }

  // 2. Turret grids states
  turretCardNodes.forEach((nodes, idx) => {
    const uid = p.fitting.turret[idx];
    const inst = uid ? getInstance(uid) : null;
    const m = inst ? MODULES[inst.baseId] : null;
    if (!inst || !m) return;

    // Power
    const isPowered = p.turretPower?.[idx] ?? false;
    const powerCd = p.turretPowerCd?.[idx] || 0;

    let powerText = "OFFLINE";
    let powerCls = "tc-pill offline";
    if (powerCd > 0) {
      powerText = isPowered ? "PWR DN..." : "PWR UP...";
      powerCls = "tc-pill cycling";
    } else if (isPowered) {
      powerText = "ONLINE";
      powerCls = "tc-pill online";
    }

    const durPct = Math.round((inst.durability / inst.maxDurability) * 100);
    if (durPct <= 0) {
      powerText = "OFFLINE";
      powerCls = "tc-pill offline";
    }

    if (nodes.lastPower !== powerText) {
      nodes.powerPill.textContent = powerText;
      nodes.powerPill.className = powerCls;
      nodes.lastPower = powerText;
    }

    // Cooldown
    const isWeaponTurret = inst.baseId && m.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
    const prof = getWeaponProfileForSlot(idx) ?? WEAPON_PROFILES[inst.baseId] ?? WEAPON_PROFILES.default;
    
    let cdPct = 0;
    let cdText = "RDY";
    
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
    const heat = p.slotHeat?.turret?.[idx] || 0;
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
      const t = targetByLockId(assignedId);
      targetText = t ? `→ ${t.name || "TARGET"}` : "→ LOCK";
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
