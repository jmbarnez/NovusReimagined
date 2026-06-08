import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getThemeColors } from "../../data/settings.js";
import { getStats } from "../../player/player-stats.js";
import { displayPlayerAngle } from "../display-orientation.js";
import { C } from "../../config/index.js";
import { getIonBoostModuleState } from "../../player/boost-module.js";
import { hudState } from "./state.js";
import { CRITICAL_GLITCH_CHANCE, CRITICAL_GLITCH_MAX_OFFSET } from "./constants.js";
import { updateHorizon } from "./horizon.js";
import { updateSpeedArc, updateShieldArc } from "./arcs.js";
import { updateSpeedLabel, updateShieldLabel, updateWarningBanner, updateTargetLabel } from "./labels.js";
import { updateDriftVectors } from "./drift.js";

export function syncPixiHUD(Wc: number, Hc: number, now: number): void {
  if (!hudState.hudContainer) return;

  const state = getState();
  const player = state.player;
  if (!player) {
    hudState.hudContainer.visible = false;
    return;
  }
  hudState.hudContainer.visible = true;

  const st = getStats(player);
  const theme = getThemeColors(Client.settings?.theme || "default");
  const cx = Wc / 2;
  const cy = Hc / 2;
  const z = Client.zoom;

  const maxShield = st.maxShield || 0;
  const shieldFrac = maxShield > 0 ? (player.shield || 0) / maxShield : 0;
  const isLowShield = maxShield > 0 && shieldFrac < 0.3;
  const isLowHull = (player.hp || 0) / (st.maxHp || 1) < 0.4;
  const isLowStruct = (player.structure || 0) / (player.maxStructure || 1) < 0.6;
  const isCritical = isLowHull || isLowStruct;

  // Visual dynamic reactive neon glitch jitter
  let gx = 0, gy = 0;
  if (isCritical && Math.random() < CRITICAL_GLITCH_CHANCE) {
    gx = (Math.random() - 0.5) * CRITICAL_GLITCH_MAX_OFFSET;
    gy = (Math.random() - 0.5) * CRITICAL_GLITCH_MAX_OFFSET;
  }

  const playerAngle = displayPlayerAngle(player);
  const speed = Math.hypot(player.vx, player.vy);
  const maxSpeed = st.maxSpeed || 1;
  const boostModule = getIonBoostModuleState(player);
  const boostSpeedMult = C.PHYSICS.SHIP.boostBaseSpeedMult
    + (boostModule.online ? C.PHYSICS.SHIP.boostModuleSpeedBonus : 0);
  const boostedMaxSpeed = maxSpeed * boostSpeedMult;
  const boostFx = player.boostFx === true;
  if (boostFx && !hudState.lastBoostFx) hudState.boostPulseUntil = now + 360;
  const boostPulse = Math.max(0, Math.min(1, (hudState.boostPulseUntil - now) / 360));
  const speedDisplayMax = boostFx ? boostedMaxSpeed : maxSpeed;
  const spdPct = Math.max(0, Math.min(1, speed / speedDisplayMax));
  const r = 38 * z;
  const span = 0.28 * Math.PI;
  const arcLineWidth = Math.max(1.5, Math.min(3, 2.0 * z));

  // Compute dirty flags once
  const zoomChanged = z !== hudState.lastZoom;
  const angleChanged = playerAngle !== hudState.lastPlayerAngle;
  const criticalChanged = isCritical !== hudState.lastIsCritical;
  const boostFxChanged = boostFx !== hudState.lastBoostFx;
  const boostPulseChanged = Math.abs(boostPulse - hudState.lastBoostPulse) > 0.05;
  const spdPctRounded = Math.round(spdPct * 100);
  const lastSpdPctRounded = Math.round(hudState.lastSpdPct * 100);
  const spdPctChanged = spdPctRounded !== lastSpdPctRounded;
  const shieldFracRounded = Math.round(shieldFrac * 100);
  const lastShieldFracRounded = Math.round(hudState.lastShieldFrac * 100);
  const shieldFracChanged = shieldFracRounded !== lastShieldFracRounded;

  // Horizon
  updateHorizon(cx, cy, z, playerAngle, isCritical, theme.textMain, gx, gy, zoomChanged, angleChanged, criticalChanged);

  // Speed arc
  updateSpeedArc(cx, cy, z, r, span, arcLineWidth, spdPct, boostFx, boostPulse, isCritical, theme.textFaint, theme.accent, gx, gy, zoomChanged, spdPctChanged, boostFxChanged, boostPulseChanged, criticalChanged);

  // Shield arc
  updateShieldArc(cx, cy, z, r, span, arcLineWidth, shieldFrac, maxShield, isLowShield, isCritical, theme.textFaint, theme.shield, gx, gy, zoomChanged, shieldFracChanged, criticalChanged);

  // Labels
  updateSpeedLabel(cx, cy, z, speed, r, isCritical, theme.textMain, gx, gy);
  updateShieldLabel(cx, cy, z, r, shieldFrac, maxShield, isLowShield, isCritical, theme.textMain, gx, gy);
  updateWarningBanner(cx, cy, r, isLowStruct, now);

  // Drift vectors
  const speedMag = Math.hypot(player.vx, player.vy);
  const driftVisible = speedMag > 5;
  const vAngle = driftVisible ? Math.atan2(player.vy, player.vx) : 0;
  const driftAngleRounded = Math.round(vAngle * 100);
  const lastDriftAngleRounded = Math.round(hudState.lastDriftAngle * 100);
  const driftSpeedRounded = Math.round(speedMag);
  const lastDriftSpeedRounded = Math.round(hudState.lastDriftSpeed);
  const driftDirty = zoomChanged || criticalChanged || driftVisible !== hudState.lastDriftVisible || driftAngleRounded !== lastDriftAngleRounded || driftSpeedRounded !== lastDriftSpeedRounded;
  updateDriftVectors(cx, cy, z, r, player, isCritical, theme.shield, theme.textDim, gx, gy, zoomChanged, criticalChanged, driftDirty);

  // Target label
  updateTargetLabel(cx, cy, isCritical, theme.textMain);

  // Update all caches at end of frame
  hudState.lastZoom = z;
  hudState.lastPlayerAngle = playerAngle;
  hudState.lastIsCritical = isCritical;
  hudState.lastBoostFx = boostFx;
  hudState.lastBoostPulse = boostPulse;
  hudState.lastSpdPct = spdPct;
  hudState.lastShieldFrac = shieldFrac;
  hudState.lastDriftAngle = vAngle;
  hudState.lastDriftSpeed = speedMag;
  hudState.lastDriftVisible = driftVisible;
}
