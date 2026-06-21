import { getState } from "../../../state-access.js";
import { SHIPS } from "../../../data/ships.js";
import { getHardpointSlotCount } from "../../../utils/hardpoints.js";
import { getStats } from "../../../player/player-stats.js";
import { getEffectiveSignatureRadius } from "../../../scanning/index.js";
import { t } from "../../../utils/i18n.js";
import { renderTurretCard } from "./turrets.js";
import { cacheTurretCardRefs } from "./live.js";
import { getIonBoostModuleState } from "../../../player/boost-module.js";
import { C } from "../../../config/index.js";
import { getElement, setHtml } from "../../dom-helpers.js";

/** Triggers full rebuild of the stats display area */
export function rebuildStatsTab() {
  const scrollContainer = getElement("ship-stats-scroll");
  if (scrollContainer) {
    setHtml(scrollContainer, renderStatsTabHTML());
    cacheTurretCardRefs();
  }
}

/** Compiles HTML representation of stats and sub-cards */
export function renderStatsTabHTML(): string {
  const p = getState().player;
  const st = getStats(p);
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
      <div class="sp-sect-h">${t("ship.specifications")}</div>
      <div class="sp-stats-grid">
        ${card(t("common.name"), ship.name)}
        ${card(t("pilot.callsign"), p.pilotName)}
        ${card(t("ship.sigRadius"), `${getEffectiveSignatureRadius(getState().player)} m`)}
        ${card(t("ship.hullMass"), `${ship.hullMassKg.toLocaleString()} kg`)}
        ${card(t("ship.massModifier"), `${st.massMult.toFixed(2)}x`)}
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
      <div class="sp-sect-h">${t("ship.defense")}</div>
      <div class="sp-stats-grid">
        ${barCard(t("ship.shieldStrength"), `<span id="sp-cur-shield">${Math.floor(p.shield)}</span> / ${st.maxShield}`, "shield", "sp-bar-shield", shieldPct)}
        ${barCard(t("ship.hullIntegrity"), `<span id="sp-cur-hp">${Math.floor(p.hp)}</span> / ${st.maxHp}`, "hull", "sp-bar-hp", hpPct)}
        ${barCard(t("ship.structureVal"), `<span id="sp-cur-struct">${Math.floor(p.structure)}</span> / ${st.maxStructure}`, "struct", "sp-bar-struct", structPct)}
        ${card(t("ship.shieldRecharge"), shieldRegen)}
        ${card(t("ship.emResist"), emRes)}
        ${card(t("ship.thermalResist"), thermRes)}
        ${card(t("ship.kineticResist"), kinRes)}
        ${card(t("ship.explosiveResist"), expRes)}
      </div>
    </div>
  `;

  // Section 3: Capacitor
  const capacitorHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">${t("ship.capacitorSection")}</div>
      <div class="sp-stats-grid">
        ${barCard(t("ship.capacitor"), `<span id="sp-cur-energy">${Math.floor(p.energy)}</span> / ${st.maxEnergy} GJ`, "cap", "sp-bar-energy", energyPct)}
        ${card(t("ship.rechargeRate"), `${st.energyRegen.toFixed(1)} GJ/s`)}
      </div>
    </div>
  `;

  // Section 4: Propulsion
  const boostModule = getIonBoostModuleState(p);
  const boostThrust = C.PHYSICS.SHIP.boostBaseThrustMult
    + (boostModule.online ? C.PHYSICS.SHIP.boostModuleThrustBonus : 0);
  const boostSpeed = C.PHYSICS.SHIP.boostBaseSpeedMult
    + (boostModule.online ? C.PHYSICS.SHIP.boostModuleSpeedBonus : 0);
  const boostCap = C.PHYSICS.SHIP.boostCapDrainPerSec
    * (boostModule.online ? C.PHYSICS.SHIP.boostModuleCapCostMult : 1);
  const propulsionHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">${t("ship.propulsion")}</div>
      <div class="sp-stats-grid">
        ${card(t("ship.ionBoostModule"), `<span id="sp-cur-boost-module">${boostModule.online ? t("ship.online") : t("ship.offline")}</span>`)}
        ${card(t("ship.builtInBoost"), `<span id="sp-cur-boost-stats">${boostThrust.toFixed(2)}x / ${boostSpeed.toFixed(2)}x</span>`)}
        ${card(t("ship.boostCapCost"), `<span id="sp-cur-boost-cap">${boostCap.toFixed(1)} GJ/s</span>`)}
        ${card(t("ship.maxSpeed"), `${st.maxSpeed.toFixed(0)} px/s (base ${st.baseMaxSpeed.toFixed(0)})`)}
        ${card(t("ship.mainThrust"), `${st.mainThrust.toFixed(0)}`)}
        ${card(t("ship.retroThrust"), `${st.retroThrust.toFixed(0)}`)}
        ${card(t("ship.lateralThrust"), `${st.lateralThrust.toFixed(0)}`)}
        ${card(t("ship.turnRate"), `${st.turnRate.toFixed(2)} rad/s (base ${st.baseTurnRate.toFixed(2)})`)}
        ${card(t("ship.agility"), `${st.thrustScale.toFixed(2)}x (base ${st.baseThrustScale.toFixed(2)})`)}
        ${card(t("ship.drag"), `${st.dragPerSec.toFixed(4)}`)}
      </div>
    </div>
  `;

  // Section 5: Sensors
  const sensorsHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">${t("ship.sensors")}</div>
      <div class="sp-stats-grid">
        ${card(t("ship.scanRange"), `${ship.sensorContactRangeKm} km`)}
      </div>
    </div>
  `;

  // Section 6: Fitting
  const pgWarn = st.usedPG > st.totalPG ? "overload" : "";
  const powergridVal = `<span class="${pgWarn}">${st.usedPG.toFixed(1)} / ${st.totalPG.toFixed(1)} PG</span>`;

  const fittingHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">${t("ship.fittingSpecs")}</div>
      <div class="sp-stats-grid">
        ${card(t("ship.powergrid"), powergridVal)}
        ${card(t("ship.cpuLoad"), `${st.usedCPU.toFixed(0)} / ${st.totalCPU.toFixed(0)} CPU`)}
        ${card(t("ship.highSlots"), getHardpointSlotCount(ship))}
        ${card(t("ship.highSlots"), ship.fitting.high)}
        ${card(t("ship.medSlots"), ship.fitting.med)}
        ${card(t("ship.lowSlots"), ship.fitting.low)}
        ${card(t("ship.cargoCapacity"), `${ship.baseCargoM3} m³`)}
      </div>
    </div>
  `;

  // Section 7: Offense / Mining
  const primaryWeaponName = st.weaponTurret?.name ?? "—";
  const ammoDesc = st.wProf.ammoType ? `${st.wProf.ammoType} (${st.wProf.ammoPerShot}/shot)` : "—";
  const mineRangeKm = ship.miningRangeKm ?? 8;

  const offenseHtml = `
    <div class="sp-sect">
      <div class="sp-sect-h">${t("ship.offense")}</div>
      <div class="sp-stats-grid">
        ${card(t("ship.primaryWeapon"), primaryWeaponName)}
        ${card(t("ship.weaponDamage"), st.finalDmg)}
        ${card(t("ship.weaponModifier"), `${st.weaponMult.toFixed(2)}x`)}
        ${card(t("ship.optimalRange"), `${st.wProf.range} px`)}
        ${card(t("ship.rateOfFire"), `${st.wProf.rate.toFixed(2)} s`)}
        ${card(t("ship.capPerShot"), `${st.wProf.ec.toFixed(1)} GJ`)}
        ${card(t("ship.ammoType"), ammoDesc)}
        ${card(t("ship.fittedMiners"), st.hasMiner ? t("common.yes") : t("common.no"))}
        ${card(t("ship.miningYieldMod"), `${st.miningMult.toFixed(2)}x`)}
        ${card(t("ship.baseMiningRange"), `${mineRangeKm} km`)}
        ${card(t("ship.fittedSalvagers"), st.hasSalvager ? t("common.yes") : t("common.no"))}
        ${card(t("ship.salvageBonus"), `${Math.round(st.salvageBonus * 100)}%`)}
      </div>
    </div>
  `;

  // Section 8: High-slot module cards
  const numHardpoints = getHardpointSlotCount(ship);
  let turretsCardsHtml = "";
  for (let idx = 0; idx < numHardpoints; idx++) {
    turretsCardsHtml += renderTurretCard(idx);
  }

  const turretsHtml = `
    <div class="sp-sect" style="margin-bottom:0;">
      <div class="sp-sect-h">${t("ship.highSlotFitting")}</div>
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
