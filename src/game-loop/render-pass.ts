import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { syncPixiWarpScreen } from "../render/pixi-warp-screen.js";
import { syncPixiPlanets } from "../render/pixi-planets.js";
import { syncPixiCelestial } from "../render/celestial/index.js";
import { syncPixiCombat } from "../render/combat/index.js";
import { syncPixiEffects } from "../render/fx/index.js";
import { syncPixiAsteroids } from "../render/pixi-asteroids.js";
import { syncPixiHitEffects } from "../render/pixi-hit-effects.js";
import { updateVignette } from "../render/pixi-vignette.js";
import { syncThrust } from "../render/pixi-thrust.js";
import { syncPixiStationInterior } from "../render/pixi-station-interior.js";
import { drawPerfOverlay } from "../render/perf-overlay.js";
import { updateHudOverlay } from "../ui/hud-overlay.js";
import { updateTutorialOverlay } from "../ui/tutorial-overlay.js";
import { renderPixi, worldContainer } from "../pixi.js";
import { updatePixiBackground } from "../render/pixi-background.js";
import { syncPixiParticles } from "../render/pixi-particles.js";
import { syncPixiEntities } from "../render/enemy/index.js";
import { syncPixiPlayer, syncPixiTrails } from "../render/player/index.js";
import { syncPixiStations } from "../render/pixi-stations.js";
import { syncPixiTutorialMarkers } from "../render/pixi-tutorial-markers.js";
import { syncPixiRegionBorders } from "../render/pixi-region-borders.js";
import { syncPixiTutorialTrack } from "../render/pixi-tutorial-track.js";
import { syncPixiTutorialGates } from "../render/pixi-tutorial-gates.js";
import { syncPixiStationOverlays } from "../render/pixi-station-overlays.js";
import { syncPixiLensFlare } from "../render/pixi-lens-flare.js";
import { syncPixiStationTurrets } from "../render/pixi-station-turrets.js";
import { syncPixiWaypoint } from "../render/pixi-waypoint.js";
import { syncPixiDamageFlash } from "../render/pixi-damage-flash.js";
import { syncPixiShockwaves, syncPixiFloatTexts, syncPixiWorldBorder } from "../render/pixi-effects-overlay.js";
import { syncPixiChatBubbles } from "../render/pixi-chat-bubbles.js";
import { syncPixiHUD } from "../render/pixi-hud-core.js";
import { syncPixiTargetArrows, syncPixiTutorialGuideArrow } from "../render/pixi-target-arrows.js";
import { drawPixiSystemMapCanvasOverlays, getPixiMapViewportBounds, invalidatePixiMapBounds, syncPixiSystemMap } from "../render/pixi-maps.js";
import { syncPixiMinimap } from "../render/pixi-minimap.js";
import { isOpen } from "../ui/hud/windows.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { curSys, updateViewportBounds } from "../utils/game.js";
import { rebuildSpatialGrid } from "../utils/spatial.js";
import { dst } from "../utils/math.js";
import { closeStationUi } from "../docking/index.js";
import { updateCamera } from "../utils/camera.js";
import { setWorldView } from "../render/world-text.js";
import { viewCenterX, viewCenterY, viewportW, viewportH, viewportLeft, viewportTop } from "../render/viewport.js";
import { updateIndustryProgress } from "../ui/station/industry.js";
import { syncPixiCrosshair } from "../render/pixi-crosshair.js";
import { recordRenderTimings, type PerfTimingMark } from "../render/perf-telemetry.js";

// Cached damage flash gradients (keyed by color, invalidated on viewport resize)

// ─── Cached DOM refs ─────────────────────────────────────────────────────────
let _cachedMapWinBody: HTMLElement | null = null;
let _lastMapOpen = false;
let _filterLogged = false;

// ─── Frame timing helper ─────────────────────────────────────────────────────
let _timingMarks: PerfTimingMark[] = [];

function timeMark(label: string): void {
  if (!Client.showPerf) return;
  if (typeof performance !== "undefined") {
    _timingMarks.push({ label, atMs: performance.now() });
  }
}

function timeFlush(): void {
  if (!Client.showPerf) {
    _timingMarks = [];
    return;
  }
  recordRenderTimings(_timingMarks, {
    logSlowFrame: Client.perfAdvanced,
    slowFrameThresholdMs: 1000 / 300,
  });
  _timingMarks = [];
}

export function drawFrame(now: number, alpha: number, frameDt: number) {
  const width = viewportW();
  const height = viewportH();
  const sys = curSys(getState().player);
  if (!sys) return;

  switch (Client.mode) {
    case AppMode.TITLE:
      drawTitleState(now, width, height, sys);
      break;
    case AppMode.SPACE:
      drawSpaceState(now, alpha, frameDt, width, height, sys);
      break;
    case AppMode.STATION:
      drawStationState(now, width, height);
      break;
  }
}

function drawTitleState(now: number, width: number, height: number, sys: System) {
  // Slow cinematic camera pan — background stays alive with nebula drift.
  // Only the left monitor content changes during loading → title.
  Client.camx += 0.8;
  Client.camy += 0.4;

  updatePixiBackground(now, Client.camx, Client.camy);
  renderPixi();
}

function drawStationState(now: number, width: number, height: number) {
  renderPixi();
  syncPixiStationInterior(now);
  updateIndustryProgress();
  updateTutorialOverlay(width, height, now);
  drawPerfOverlay();
}

function drawSpaceState(now: number, alpha: number, frameDt: number, width: number, height: number, sys: System) {
  timeMark("start");

  // Hoist state once to avoid repeated object allocations
  const state = getState();
  const player = state.player;

  // Ensure per-system live caches exist so renderers have data even if a tick missed rebuild.
  // Guard: only rebuild when the cache arrays are truly absent, not when they were already
  // built this tick. The simulation tick itself rebuilds the grid; we only patch here.
  const needsEnemyCache = !sys._liveEnemies;
  const needsAsteroidCache = !sys._liveAsteroids;
  if (needsEnemyCache || needsAsteroidCache) {
    rebuildSpatialGrid(sys.idx);
  }
  timeMark("spatial");

  // Camera locks to the interpolated player position — same alpha as the ship
  // sprite, so the player sits at a fixed screen point with zero relative jitter.
  updateCamera(alpha);
  const camxR = Client.camx;
  const camyR = Client.camy;
  const viewCX = viewCenterX(width);
  const viewCY = viewCenterY(height);
  Client.mouseWorld.x = (Client.mouse.x - viewportLeft() - viewCX) / Client.zoom + camxR;
  Client.mouseWorld.y = (Client.mouse.y - viewportTop() - viewCY) / Client.zoom + camyR;

  updateViewportBounds(width, height, Client.zoom, camxR, camyR, 240);
  setWorldView(width, height, camxR, camyR, Client.zoom);
  timeMark("camera");

  // Update PixiJS world container camera transform
  if (worldContainer) {
    worldContainer.x = viewCX - camxR * Client.zoom;
    worldContainer.y = viewCY - camyR * Client.zoom;
    worldContainer.scale.set(Client.zoom);
    if (worldContainer.filterArea && (worldContainer.filters?.length ?? 0) > 0) {
      worldContainer.filterArea.x = camxR - viewCX / Client.zoom;
      worldContainer.filterArea.y = camyR - viewCY / Client.zoom;
      worldContainer.filterArea.width = width / Client.zoom;
      worldContainer.filterArea.height = height / Client.zoom;
    }
  }

  updatePixiBackground(now, camxR, camyR);
  timeMark("bg");
  syncPixiParticles();
  timeMark("particles");
  syncPixiStations(now, sys);
  timeMark("stations");
  syncPixiEntities(alpha, now);
  timeMark("entities");
  syncPixiPlayer(alpha, now);
  timeMark("player");
  syncPixiTrails();
  timeMark("trails");
  syncPixiPlanets(now);
  timeMark("planets");
  syncPixiCelestial(now, alpha, sys);
  timeMark("celestial");
  syncPixiCombat(now, alpha, sys);
  timeMark("combat");
  syncPixiEffects(now, alpha, frameDt, sys);
  timeMark("effects");
  syncPixiAsteroids(now, alpha, sys);
  timeMark("asteroids");
  syncPixiHitEffects(now, alpha, sys);
  timeMark("hiteffects");
  const tutorialActive = player?.tutorial?.active;
  if (tutorialActive) syncPixiTutorialMarkers(now, sys);
  timeMark("tutmarkers");
  syncPixiRegionBorders(now);
  timeMark("borders");
  if (tutorialActive) syncPixiTutorialTrack(now);
  timeMark("tuttrack");
  syncPixiTutorialGates(now);
  timeMark("tutgates");
  syncPixiStationOverlays(now, sys);
  timeMark("stoverlays");
  syncPixiStationTurrets(now, sys);
  timeMark("stturrets");
  if (Client.settings?.lensFlare) syncPixiLensFlare(width, height);
  timeMark("lensflare");
  syncPixiWaypoint(now);
  timeMark("waypoint");
  syncPixiDamageFlash(width, height);
  timeMark("dmgflash");
  syncPixiShockwaves();
  timeMark("shockwaves");
  syncPixiFloatTexts();
  timeMark("floattexts");
  syncPixiChatBubbles(now);
  timeMark("chat");
  syncPixiWorldBorder(now, SECTOR_OUTER_RADIUS);
  timeMark("worldborder");
  syncPixiCrosshair();
  timeMark("crosshair");

  // Cached DOM reads: only look up the element when map window open-state changes
  const mapOpen = isOpen("map");
  if (mapOpen !== _lastMapOpen) {
    _cachedMapWinBody = mapOpen ? document.getElementById("hud-win-body-map") : null;
    _lastMapOpen = mapOpen;
    invalidatePixiMapBounds();
  }
  const mapBounds = _cachedMapWinBody ? getPixiMapViewportBounds(width, height) : null;
  if (mapBounds) {
    syncPixiSystemMap(mapBounds.width, mapBounds.height, now);
  }
  timeMark("map");

  syncThrust(alpha, now);
  timeMark("thrust");
  syncPixiHUD(width, height, now);
  timeMark("hud");
  syncPixiTargetArrows(width, height, camxR, camyR, now);
  timeMark("tarrows");
  if (tutorialActive) syncPixiTutorialGuideArrow(width, height, camxR, camyR, now);
  timeMark("guidearrow");
  if (Client.settings?.vignetteEnabled) updateVignette();
  timeMark("vignette");
  renderPixi();
  timeMark("renderPixi");
  // One-time debug: check if the expensive ColorMatrixFilter is active
  if (worldContainer && (worldContainer.filters?.length ?? 0) > 0 && !_filterLogged) {
    _filterLogged = true;
    const names = worldContainer.filters.map((f) => ((f as unknown) as Record<string, unknown>).constructor?.name ?? "unknown");
    console.log("[PERF] worldContainer.filters active:", names);
  }

  // Canvas 2D map overlays sit above Pixi and are clipped to the map window body.
  if (mapBounds) {
    drawPixiSystemMapCanvasOverlays(mapBounds.width, mapBounds.height, now);
  }
  timeMark("mapoverlays");

  // Minimap (always visible during gameplay)
  syncPixiMinimap(now);
  timeMark("minimap");

  if (player && ((player.warpTargetIdx ?? -1) >= 0 || (player.warpCooldown ?? 0) > 2.0)) {
    syncPixiWarpScreen(now);
  }
  timeMark("warpscreen");

  if (Client.stationOpen && Client.activeStation) {
    const station = Client.activeStation;
    if (dst(player.x, player.y, station.x, station.y) > station.radius * 4) {
      closeStationUi();
    }
  }
  timeMark("stationcheck");

  if (!Client.stationOpen) updateHudOverlay(width, height, now);
  timeMark("hudoverlay");
  updateIndustryProgress();
  timeMark("industry");
  updateTutorialOverlay(width, height, now);
  timeMark("tutorial");
  drawPerfOverlay();
  timeMark("perfoverlay");
  timeMark("end");

  timeFlush();
}
