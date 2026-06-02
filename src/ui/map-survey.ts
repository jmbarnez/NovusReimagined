import { TAU } from "../constants.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { Graphics } from "pixi.js";
import { curSys } from "../utils/game.js";
import { getUIFont } from "../render/ui-font.js";
import { radarPingOpacity, radarSignatureDecayExponent, radarSweepAngle } from "../utils/radar-sweep.js";
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
import { queueFrameAction } from "../sim/input.js";
import {
  bearingToPointDeg,
  getScanPulseRemainingMs,
  getScanRangePx,
  getActiveScannerIndex,
  getMapScannerDrainPerSec,
  getEffectiveSignatureRadius,
  mapScannerStrengthStepIndex,
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
  Client.mapScannerAngleDeg = bearingToPointDeg(getState().player.x, getState().player.y, wx, wy);
  return true;
}

export function setMapWaypointFromScreen(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const xform = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!xform) return false;
  if (Client.settings.movementControlMode !== "waypoint") {
    logEvent(t("map.survey.directMode"), "system");
    return false;
  }
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
  queueFrameAction({ type: "setMapScannerPower", payload: { active: next } }, { replaceByType: true });
  sfxBlip(next ? 720 : 480, 0.03);
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
    const stepsDenom = Math.max(1, C.SCANNING.MAP_STRENGTH_STEPS - 1);
    const strength = Math.max(0, Math.min(1, step / stepsDenom));
    queueFrameAction({ type: "setMapScannerStrength", payload: { strength } }, { replaceByType: true });
    if (step !== prev) sfxBlip(640 + step * 120, 0.02);
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
      queueFrameAction({
        type: "setMapScannerCone",
        payload: { coneDeg: Number(cone) as 180 | 90 | 45 | 15 },
      }, { replaceByType: true });
      return;
    }
    if (target.dataset.action === "scan") {
      queueFrameAction({
        type: "startScanPulse",
        payload: { angleDeg: Client.mapScannerAngleDeg },
      }, { replaceByType: true });
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
  signatureRadius?: number,
): number {
  return radarPingOpacity(
    blipMapX,
    blipMapY,
    originMapX,
    originMapY,
    radarSweepAngle(now),
    radarSignatureDecayExponent(signatureRadius),
  );
}

/** Draw hull passive radar sweep and range rings on the system map (always while map is open). */
export function drawPassiveRadarOverlay(t: SystemMapTransform, now: number, g: Graphics): void {
  const ship = SHIPS[getState().player.shipId];
  const rangeScreen = getPassiveScanRangePx(ship) * t.scale;
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const sweep = radarSweepAngle(now);

  // Range rings
  g.stroke({ color: 0x64a0dc, width: 1, alpha: 0.22 });
  g.circle(pp.x, pp.y, rangeScreen * 0.35);
  g.stroke();
  g.circle(pp.x, pp.y, rangeScreen * 0.7);
  g.stroke();

  // Outer ring (dashed) — Pixi v8 doesn't expose setLineDash on Graphics, so draw
  // the ring as a single stroke at low alpha; the dashed look was a subtle hint
  // and is acceptable when solid.
  g.stroke({ color: 0x64a0dc, width: 1, alpha: 0.32 });
  g.circle(pp.x, pp.y, rangeScreen);
  g.stroke();

  // Sweep wedge — approximate the radial gradient by overlaying two alpha
  // fills (inner brighter, outer transparent).
  const sweepSpan = 0.38;
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rangeScreen, sweep - sweepSpan, sweep);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: 0.06 });
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rangeScreen * 0.5, sweep - sweepSpan, sweep);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: 0.05 });

  // Sweep leading edge
  g.moveTo(pp.x, pp.y);
  g.lineTo(pp.x + Math.cos(sweep) * rangeScreen, pp.y + Math.sin(sweep) * rangeScreen);
  g.stroke({ color: 0x9ee8ff, width: 1.4, alpha: 0.42 });
}

/** Survey signature blips: passive decay always; stronger when active scanner is emitting. */
export function mapSignatureOpacity(
  blipMapX: number,
  blipMapY: number,
  originMapX: number,
  originMapY: number,
  now: number,
  signatureRadius?: number,
): number {
  const ping = passiveContactOpacity(blipMapX, blipMapY, originMapX, originMapY, now, signatureRadius);
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

export function drawMapSurveyOverlay(t: SystemMapTransform, now: number, g: Graphics) {
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const angleRad = Client.mapScannerAngleDeg * Math.PI / 180;
  const halfCone = (getState().player.scannerConeDeg / 2) * Math.PI / 180;
  const rayLen = getScanRangePx(getState().player) * t.scale;
  const sweep = radarSweepAngle(now);
  const emitting = isMapScannerEmitting(getState().player);

  if (emitting) {
    g.moveTo(pp.x, pp.y);
    g.arc(pp.x, pp.y, rayLen, sweep - 0.4, sweep);
    g.closePath();
    g.fill({ color: 0x6fd3ff, alpha: 0.10 });

    g.moveTo(pp.x, pp.y);
    g.lineTo(pp.x + Math.cos(sweep) * rayLen, pp.y + Math.sin(sweep) * rayLen);
    g.stroke({ color: 0x9ee8ff, width: 1.4, alpha: 0.55 });
  }

  // Cone fill
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rayLen, angleRad - halfCone, angleRad + halfCone);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: emitting ? 0.3 : 0.18 });

  // Cone centerline
  g.moveTo(pp.x, pp.y);
  g.lineTo(pp.x + Math.cos(angleRad) * rayLen, pp.y + Math.sin(angleRad) * rayLen);
  g.stroke({ color: emitting ? 0x9ee8ff : 0x6a9eb8, width: emitting ? 2 : 1.5, alpha: emitting ? 0.9 : 0.55 });

  // Range ring
  g.circle(pp.x, pp.y, rayLen);
  g.stroke({ color: 0x6fd3ff, width: 1, alpha: 0.22 });
}

let mapTutorialListenersBound = false;

export function initMapSurvey() {
  // Styles loaded via map-overlay.css
  if (mapTutorialListenersBound) return;
  mapTutorialListenersBound = true;
  on("tutorial:step-change", () => updateMapTutorialStrip());
  on("tutorial:hangar-tour-change", () => updateMapTutorialStrip());
}
