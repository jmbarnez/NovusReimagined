import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import type { System } from "../../types/world.js";
import { shouldShowWarpGate } from "../../data/tutorial.js";
import { t } from "../../utils/i18n.js";
import { openHudWindow, isOpen, closeHudWindow, getHudWindow } from "../hud/windows.js";
import { app } from "../../pixi.js";
import { pixiMapState } from "../../render/pixi-maps/state.js";
import { getElement, createElement, setHtml, setStyle } from "../dom-helpers.js";

export function closeMapWindow() {
  Client.showMap = false;
  closeHudWindow("map");
}

export function toggleMapWindow() {
  if (isOpen("map")) {
    closeMapWindow();
  } else {
    // Create DOM content for window body
    const sys = getState().player ? curSys() : null;
    const contentEl = createElement("div", "map-overlay");
    contentEl.id = "map-overlay";
    setStyle(contentEl, { position: "relative", width: "100%", height: "100%", overflow: "hidden" });
    
    if (sys) {
      updateMapOverlayDOM(sys, contentEl);
    }
    
    Client.showMap = true;
    openHudWindow("map", "NOVUS", contentEl, () => {
      // Close callback - reset zoom/pan
      Client.showMap = false;
      Client.mapZoom = 1.0;
      Client.mapPanX = 0;
      Client.mapPanY = 0;
      if (pixiMapState.positioningContainer) pixiMapState.positioningContainer.visible = false;
    });
    
    // Set default window size and center it
    const win = getHudWindow("map");
    if (win) {
      setStyle(win, { width: "800px", height: "600px", left: `${(window.innerWidth - 800) / 2}px`, top: `${(window.innerHeight - 600) / 2}px`, right: "auto" });
    }
    
    // Position PixiJS container to match window
    if (win && pixiMapState.positioningContainer && app) {
      // positioningContainer is already added to app.stage in initPixiMaps
      pixiMapState.positioningContainer.visible = true;
      // Position will be updated in render loop based on window position
    }
  }
}

function curSys() {
  const state = getState();
  const player = state.player;
  if (!player) return null;
  return state.GALAXY[player.sysIdx] || null;
}

export function updateMapOverlayDOM(sys: System, targetEl?: HTMLElement) {
  const overlayEl = targetEl ?? getElement("map-overlay");
  if (!overlayEl || !sys) return;

  const hasStations = sys.stations.length > 0;
  const hasGates = sys.gates.some((g) => shouldShowWarpGate(g, sys.idx, getState().player));
  const hasHostiles = sys.enemies.some((e) => e.alive);
  const hasAsteroids = sys.asteroids.some((a) => !a.depleted && a.hp > 0);
  const hasScanSites = sys.hiddenSites?.some((s) => s.state !== "hidden" && s.state !== "cleared");

  let legendHtml = `
    <div class="map-legend-title">${t("hud.mapLegend")}</div>
    <div class="map-legend-items">
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="var(--hud-accent)" /></svg></span>
        <span>${t("hud.legendStar")}</span>
      </div>
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="var(--hud-text-bright)" /></svg></span>
        <span>${t("hud.legendPlayer")}</span>
      </div>
  `;

  if (hasStations) {
    legendHtml += `
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="var(--hud-positive)" /></svg></span>
        <span>${t("hud.legendStation")}</span>
      </div>
    `;
  }
  if (hasGates) {
    legendHtml += `
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill="var(--hud-shield)" /></svg></span>
        <span>${t("hud.legendGate")}</span>
      </div>
    `;
  }
  if (hasHostiles) {
    legendHtml += `
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1.5 10.5,10 1.5,10" fill="var(--hud-danger)" /></svg></span>
        <span>${t("hud.legendHostile")}</span>
      </div>
    `;
  }
  if (hasAsteroids) {
    legendHtml += `
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="color-mix(in srgb, var(--hud-hull) 65%, transparent)" /></svg></span>
        <span>${t("hud.legendAsteroid")}</span>
      </div>
    `;
  }
  if (hasScanSites) {
    legendHtml += `
      <div class="map-legend-item">
        <span class="map-legend-shape"><svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill="none" stroke="var(--hud-shield)" stroke-width="1.5" /></svg></span>
        <span>${t("hud.legendScanSite")}</span>
      </div>
    `;
  }

  legendHtml += `</div>`;

  const headerHtml = `
    <div class="map-header">
      <h1 id="map-title">${t("hud.mapTitle")}</h1>
      <p id="map-subtitle">${t("hud.mapSubtitle")}</p>
    </div>
    <div class="map-legend">${legendHtml}</div>
  `;

  if (overlayEl.innerHTML !== headerHtml) {
    setHtml(overlayEl, headerHtml);
  }
}
