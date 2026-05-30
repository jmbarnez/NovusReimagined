import { TAU } from "../constants.js";
import { Client } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { ctx } from "../canvas.js";
import { curSys } from "../utils/game.js";
import { getUIFont } from "../render/ui-font.js";
import { radarPingOpacity, radarSweepAngle } from "../utils/radar-sweep.js";
import { savePlayer } from "../player/player-data.js";
import { C } from "../config/index.js";
import {
  computeDiscoveredMapBounds,
  isLocalRegionDiscovered,
  isSectorDiscovered,
  systemsVisibleOnMap,
  canSetMapWaypointAt,
  type LocalRegionDef,
} from "../map-discovery.js";
import { sfxBlip } from "../audio/procedural.js";
import { clearNav } from "../state-access.js";
import {
  bearingToPointDeg,
  getScanPulseRemainingMs,
  startScanPulse,
  getScanRangePx,
  getActiveScannerIndex,
  getMapScannerDrainPerSec,
  getEffectiveSignatureRadius,
  mapScannerStrengthStepIndex,
  setMapScannerStrengthFromStep,
  isMapScannerEmitting,
  getMapScannerStrength01,
} from "../scanning.js";
import { getPassiveScanRangePx } from "../targeting.js";
import { SHIPS } from "../data/ships.js";
import { logEvent } from "../feedback.js";
import type { System } from "../types/world.js";
import { on } from "../events.js";
import { t } from "../utils/i18n.js";
import { getCurrentTutorialStep, getTutorialNavProgress, getTutorialNavRemainingM, getTutorialStepObjective } from "../data/tutorial.js";
import { getTutorialTrackById, snapToTrackCenterline } from "../data/tutorial-layout.js";

export interface SystemMapTransform {
  mnX: number;
  mnY: number;
  mxX: number;
  myY: number;
  scale: number;
  Wc: number;
  Hc: number;
  centerMx: number;
  centerMy: number;
}

const CONE_PRESETS = [180, 90, 45, 15] as const;

let panelEl: HTMLDivElement | null = null;
let mapTutorialStripEl: HTMLDivElement | null = null;
let statusEl: HTMLElement | null = null;
let strengthInput: HTMLInputElement | null = null;

export function resetMapPan(): void {
  Client.mapPanX = 0;
  Client.mapPanY = 0;
  Client.mapDragging = false;
}

export function applyMapPanDrag(sx: number, sy: number, t: SystemMapTransform): void {
  const dx = sx - Client.mapDragLastSx;
  const dy = sy - Client.mapDragLastSy;
  Client.mapDragLastSx = sx;
  Client.mapDragLastSy = sy;
  Client.mapPanX -= dx / t.scale;
  Client.mapPanY -= dy / t.scale;
}

export { systemsVisibleOnMap, isSectorDiscovered, isLocalRegionDiscovered };
export type { LocalRegionDef };

function computeMapBounds(sys: System) {
  const px = getState().player ? getState().player.x : 0;
  const py = getState().player ? getState().player.y : 0;
  return computeDiscoveredMapBounds(sys, px, py, getState().player);
}

export function computeSystemMapTransform(Wc: number, Hc: number): SystemMapTransform | null {
  const sys = curSys(getState().player);
  if (!sys) return null;
  const { mnX, mnY, mxX, myY } = computeMapBounds(sys);
  let scale = Math.min((Wc - 300) / (mxX - mnX || 1), (Hc - 130) / (myY - mnY || 1), 0.95);
  scale *= Client.mapZoom;
  const centerMx = (getState().player ? getState().player.x : (mnX + mxX) / 2) + Client.mapPanX;
  const centerMy = (getState().player ? getState().player.y : (mnY + myY) / 2) + Client.mapPanY;
  return {
    mnX, mnY, mxX, myY, scale, Wc, Hc,
    centerMx,
    centerMy,
  };
}

export function worldToMapScreen(wx: number, wy: number, t: SystemMapTransform) {
  return {
    x: t.Wc / 2 + (wx - t.centerMx) * t.scale,
    y: t.Hc / 2 + 30 + (wy - t.centerMy) * t.scale,
  };
}

export function mapScreenToWorld(sx: number, sy: number, t: SystemMapTransform) {
  return {
    x: t.centerMx + (sx - t.Wc / 2) / t.scale,
    y: t.centerMy + (sy - (t.Hc / 2 + 30)) / t.scale,
  };
}

export function aimScannerAtMapPoint(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const t = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!t) return false;
  const { x: wx, y: wy } = mapScreenToWorld(sx, sy, t);
  const bearing = bearingToPointDeg(getState().player.x, getState().player.y, wx, wy);
  PlayerAccess.setScannerAngle(bearing);
  return true;
}

export function setMapWaypointFromScreen(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const xform = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!xform) return false;
  let { x: wx, y: wy } = mapScreenToWorld(sx, sy, xform);
  if (!canSetMapWaypointAt(wx, wy, getState().player)) {
    logEvent(t("map.survey.waypointSector"), "system");
    return false;
  }
  const step = getState().player?.tutorial?.active ? getCurrentTutorialStep(getState().player) : null;
  if (step?.nav) {
    const track = getTutorialTrackById(step.nav.trackId);
    if (track) {
      const snapped = snapToTrackCenterline(track, wx, wy);
      wx = snapped.x;
      wy = snapped.y;
    }
  }
  Client.waypoint = { x: wx, y: wy };
  clearNav();
  sfxBlip(520, 0.03);
  return true;
}

function toggleScannerPower(): void {
  const next = !getState().player.mapScannerActive;
  if (next && getActiveScannerIndex(getState().player) === -1) {
    logEvent(t("map.survey.powerOn"), "system");
    return;
  }
  PlayerAccess.setMapScannerActive(next);
  sfxBlip(next ? 720 : 480, 0.03);
  savePlayer();
  updatePanelControls();
}

function ensurePanel() {
  if (panelEl) return;
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  panelEl = document.createElement("div");
  panelEl.id = "map-scanner-panel";
  panelEl.innerHTML = `
    <div class="map-scanner-row">
      <button type="button" data-action="power" class="map-scanner-power" title="${t("map.survey.power")}">${t("map.survey.power")}</button>
      <div class="map-scanner-dial">
        <span class="map-scanner-dial-label">${t("map.survey.strength")}</span>
        <input type="range" class="map-scanner-strength" min="0" max="${steps - 1}" step="1" value="2" />
      </div>
      <div class="map-survey-cones"></div>
      <button type="button" data-action="scan" class="map-survey-scan">${t("map.survey.scan")}</button>
    </div>
    <div class="map-scanner-status">${t("map.survey.off")}</div>
  `;
  (document.getElementById("hud-overlay") || document.body).appendChild(panelEl);
  statusEl = panelEl.querySelector(".map-scanner-status");
  strengthInput = panelEl.querySelector(".map-scanner-strength");

  const coneWrap = panelEl.querySelector(".map-survey-cones")!;
  for (const deg of CONE_PRESETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.cone = String(deg);
    btn.textContent = `${deg}°`;
    coneWrap.appendChild(btn);
  }

  strengthInput?.addEventListener("input", () => {
    const step = Number(strengthInput!.value);
    const prev = mapScannerStrengthStepIndex(getState().player);
    setMapScannerStrengthFromStep(step, getState().player);
    if (step !== prev) sfxBlip(640 + step * 120, 0.02);
    savePlayer();
    updatePanelControls();
  });

  panelEl.addEventListener("click", (ev) => {
    const target = (ev.target as HTMLElement).closest("button");
    if (!target || !panelEl) return;
    if (target.dataset.action === "power") {
      toggleScannerPower();
      return;
    }
    const cone = target.dataset.cone;
    if (cone) {
      PlayerAccess.setScannerConeDeg(Number(cone) as 180 | 90 | 45 | 15);
      updatePanelControls();
      return;
    }
    if (target.dataset.action === "scan") {
      const result = startScanPulse(getState().player);
      if (!result.started && result.reason) logEvent(result.reason, "system");
    }
  });
}

function updatePanelControls() {
  if (!panelEl) return;
  panelEl.querySelectorAll("[data-cone]").forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.classList.toggle("active", Number(el.dataset.cone) === getState().player.scannerConeDeg);
  });
  const powerBtn = panelEl.querySelector(".map-scanner-power");
  powerBtn?.classList.toggle("active", getState().player.mapScannerActive);
  const scanBtn = panelEl.querySelector(".map-survey-scan") as HTMLButtonElement | null;
  const remaining = getScanPulseRemainingMs(Date.now(), getState().player);
  const powered = getState().player.mapScannerActive;
  if (scanBtn) scanBtn.disabled = remaining > 0 || !powered;
  if (strengthInput) {
    strengthInput.disabled = !powered;
    strengthInput.value = String(mapScannerStrengthStepIndex(getState().player));
  }
}

function formatStatusLine(): string {
  const remaining = getScanPulseRemainingMs(Date.now(), getState().player);
  if (remaining > 0) {
    return `Scanning · ${Math.ceil(remaining / 1000)}s · ${getState().player.scannerConeDeg}°`;
  }
  if (!getState().player.mapScannerActive) {
    return `Off · hover aim · left-click waypoint · right-drag pan · ${getState().player.scannerConeDeg}°`;
  }
  const drain = getMapScannerDrainPerSec(getState().player).toFixed(1);
  const sig = getEffectiveSignatureRadius(getState().player);
  return `Live · ${drain}/s cap · sig ${sig}m · ${getState().player.scannerConeDeg}°`;
}

/** Phosphor decay for hull passive radar (minimap + system map). */
export function passiveContactOpacity(
  blipMapX: number,
  blipMapY: number,
  originMapX: number,
  originMapY: number,
  now: number,
): number {
  return radarPingOpacity(blipMapX, blipMapY, originMapX, originMapY, radarSweepAngle(now));
}

/** Draw hull passive radar sweep and range rings on the system map (always while map is open). */
export function drawPassiveRadarOverlay(t: SystemMapTransform, now: number): void {
  const ship = SHIPS[getState().player.shipId];
  const rangeScreen = getPassiveScanRangePx(ship) * t.scale;
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const sweep = radarSweepAngle(now);

  ctx.save();

  ctx.strokeStyle = "rgba(100, 160, 220, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, rangeScreen * 0.35, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, rangeScreen * 0.7, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(100, 160, 220, 0.32)";
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, rangeScreen, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  const sweepGrad = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rangeScreen);
  sweepGrad.addColorStop(0, "rgba(111, 211, 255, 0.1)");
  sweepGrad.addColorStop(0.85, "rgba(111, 211, 255, 0.03)");
  sweepGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.arc(pp.x, pp.y, rangeScreen, sweep - 0.38, sweep);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(158, 232, 255, 0.42)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.lineTo(pp.x + Math.cos(sweep) * rangeScreen, pp.y + Math.sin(sweep) * rangeScreen);
  ctx.stroke();

  ctx.restore();
}

/** Survey signature blips: passive decay always; stronger when active scanner is emitting. */
export function mapSignatureOpacity(
  blipMapX: number,
  blipMapY: number,
  originMapX: number,
  originMapY: number,
  now: number,
): number {
  const ping = passiveContactOpacity(blipMapX, blipMapY, originMapX, originMapY, now);
  if (!isMapScannerEmitting(getState().player)) return ping;
  return ping * (0.35 + 0.65 * getMapScannerStrength01(getState().player));
}

function ensureMapTutorialStrip() {
  if (mapTutorialStripEl) return;
  mapTutorialStripEl = document.createElement("div");
  mapTutorialStripEl.id = "map-tutorial-strip";
  mapTutorialStripEl.innerHTML = `
    <div class="map-tutorial-strip-title"></div>
    <div class="map-tutorial-strip-objective"></div>
    <div class="tutorial-nav-progress">
      <div class="tutorial-nav-progress-track"><div class="tutorial-nav-progress-fill"></div></div>
      <span class="tutorial-nav-progress-label"></span>
    </div>
  `;
  (document.getElementById("hud-overlay") || document.body).appendChild(mapTutorialStripEl);
}

function updateMapTutorialStrip() {
  const show = Client.showMap && Client.showSystemMap && getState().player?.tutorial?.active;
  if (!show) {
    if (mapTutorialStripEl) mapTutorialStripEl.style.display = "none";
    return;
  }
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.nav) {
    if (mapTutorialStripEl) mapTutorialStripEl.style.display = "none";
    return;
  }
  ensureMapTutorialStrip();
  if (!mapTutorialStripEl) return;
  mapTutorialStripEl.style.display = "block";
  const titleEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-title");
  const objEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-objective");
  const fillEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-fill") as HTMLElement | null;
  const labelEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-label");
  if (titleEl) titleEl.textContent = step.title;
  if (objEl) objEl.textContent = getTutorialStepObjective(step);
  const progress = getTutorialNavProgress(step, getState().player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, getState().player);
  if (fillEl) fillEl.style.width = `${Math.round(progress * 100)}%`;
  if (labelEl) {
    labelEl.textContent = remaining != null
      ? `${(remaining / 1000).toFixed(1)} km to ${step.nav.label}`
      : "";
  }
}

export function updateMapSurveyUi() {
  const show = Client.showMap && Client.showSystemMap;
  if (!show) {
    if (panelEl) panelEl.style.display = "none";
    updateMapTutorialStrip();
    return;
  }
  ensurePanel();
  if (!panelEl || !statusEl) return;
  panelEl.style.display = "flex";
  updatePanelControls();
  statusEl.textContent = formatStatusLine();
  updateMapTutorialStrip();
}

export function drawMapSurveyOverlay(t: SystemMapTransform, now: number) {
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const angleRad = getState().player.scannerAngle * Math.PI / 180;
  const halfCone = (getState().player.scannerConeDeg / 2) * Math.PI / 180;
  const rayLen = getScanRangePx(getState().player) * t.scale;
  const sweep = radarSweepAngle(now);
  const emitting = isMapScannerEmitting(getState().player);

  ctx.save();

  if (emitting) {
    const sweepGrad = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rayLen);
    sweepGrad.addColorStop(0, "rgba(111, 211, 255, 0.16)");
    sweepGrad.addColorStop(0.85, "rgba(111, 211, 255, 0.04)");
    sweepGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y);
    ctx.arc(pp.x, pp.y, rayLen, sweep - 0.4, sweep);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(158, 232, 255, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(pp.x + Math.cos(sweep) * rayLen, pp.y + Math.sin(sweep) * rayLen);
    ctx.stroke();
  }

  ctx.globalAlpha = emitting ? 0.3 : 0.18;
  ctx.fillStyle = "#6fd3ff";
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.arc(pp.x, pp.y, rayLen, angleRad - halfCone, angleRad + halfCone);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = emitting ? 0.9 : 0.55;
  ctx.strokeStyle = emitting ? "#9ee8ff" : "#6a9eb8";
  ctx.lineWidth = emitting ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.lineTo(pp.x + Math.cos(angleRad) * rayLen, pp.y + Math.sin(angleRad) * rayLen);
  ctx.stroke();

  ctx.strokeStyle = "rgba(111, 211, 255, 0.22)";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, rayLen, 0, TAU);
  ctx.stroke();

  ctx.restore();
}

let mapTutorialListenersBound = false;

export function initMapSurvey() {
  // Styles loaded via map-overlay.css
  if (mapTutorialListenersBound) return;
  mapTutorialListenersBound = true;
  on("tutorial:step-change", () => updateMapTutorialStrip());
  on("tutorial:hangar-tour-change", () => updateMapTutorialStrip());
}
