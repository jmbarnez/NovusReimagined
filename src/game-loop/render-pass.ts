import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/system.js";
import { syncPixiStationInterior } from "../render/pixi-station-interior.js";
import { drawPerfOverlay } from "../render/perf-overlay.js";
import { updateHudOverlay } from "../ui/hud-overlay.js";
import { updateTutorialOverlay } from "../tutorial/ui/index.js";
import { renderPixi, worldContainer } from "../pixi.js";
import { updatePixiBackground } from "../render/pixi-background.js";
import { getPixiMapViewportBounds, invalidatePixiMapBounds } from "../render/pixi-maps.js";
import { isOpen } from "../ui/hud/windows.js";
import { curSys, updateViewportBounds } from "../utils/game.js";
import { rebuildSpatialGrid } from "../utils/spatial.js";
import { dst } from "../utils/math.js";
import { closeStationUi } from "../docking/index.js";
import { updateClientWarpHint } from "../docking/warp.js";
import { updateCamera } from "../utils/camera.js";
import { setWorldView } from "../render/world-text.js";
import { viewCenterX, viewCenterY, viewportW, viewportH, viewportLeft, viewportTop } from "../render/viewport.js";
import { updateIndustryProgress } from "../ui/station/industry.js";
import { recordRenderTimings, type PerfTimingMark } from "../render/perf-telemetry.js";
import { runSpaceFrameSystems } from "../render/space-frame-systems.js";
import type { SpaceFrameSystemId } from "../render/space-frame-system-order.js";

// Cached damage flash gradients (keyed by color, invalidated on viewport resize)

// ─── Cached DOM refs ─────────────────────────────────────────────────────────
let _cachedMapWinBody: HTMLElement | null = null;
let _lastMapOpen = false;

// ─── Frame timing helper ─────────────────────────────────────────────────────
let _timingMarks: PerfTimingMark[] = [];

function timeMark(label: string): void {
  if (!Client.showPerf) return;
  if (typeof performance !== "undefined") {
    _timingMarks.push({ label, atMs: performance.now() });
  }
}

function markFrameSystem(id: SpaceFrameSystemId): void {
  timeMark(id);
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

  // Drive client-side warp gate charging visuals independently of server snapshots
  updateClientWarpHint(frameDt);

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

  const tutorialActive = player?.tutorial?.active;

  // Cached DOM reads: only look up the element when map window open-state changes
  const mapOpen = isOpen("map");
  if (mapOpen !== _lastMapOpen) {
    _cachedMapWinBody = mapOpen ? document.getElementById("hud-win-body-map") : null;
    _lastMapOpen = mapOpen;
    invalidatePixiMapBounds();
  }
  const mapBounds = _cachedMapWinBody ? getPixiMapViewportBounds(width, height) : null;
  runSpaceFrameSystems({
    now,
    alpha,
    frameDt,
    width,
    height,
    sys,
    player,
    camxR,
    camyR,
    tutorialActive: tutorialActive === true,
    mapBounds,
  }, markFrameSystem);

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
