import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { drawWarpScreen } from "../render/hud.js";
import { syncPixiPlanets } from "../render/pixi-planets.js";
import { syncPixiCelestial } from "../render/pixi-celestial.js";
import { syncPixiCombat } from "../render/pixi-combat.js";
import { syncPixiEffects } from "../render/pixi-effects.js";
import { syncPixiAsteroids } from "../render/pixi-asteroids.js";
import { syncPixiHitEffects } from "../render/pixi-hit-effects.js";
import { updateVignette } from "../render/pixi-vignette.js";
import { syncThrust } from "../render/pixi-thrust.js";
import { drawStationInterior } from "../render/station-interior.js";
import { drawPerfOverlay } from "../render/perf-overlay.js";
import { updateHudOverlay } from "../ui/hud-overlay.js";
import { updateTutorialOverlay } from "../ui/tutorial-overlay.js";
import { ctx, W, H, canvasLeft, canvasTop } from "../canvas.js";
import { renderPixi, worldContainer } from "../pixi.js";
import { updatePixiBackground } from "../render/pixi-background.js";
import { syncPixiParticles } from "../render/pixi-particles.js";
import { syncPixiEntities } from "../render/pixi-entities.js";
import { syncPixiPlayer, syncPixiTrails } from "../render/pixi-player.js";
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
import { drawPixiSystemMapCanvasOverlays, syncPixiSystemMap } from "../render/pixi-maps.js";
import { syncPixiMinimap } from "../render/pixi-minimap.js";
import { isOpen } from "../ui/hud/windows.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { curSys, updateViewportBounds } from "../utils/game.js";
import { rebuildSpatialGrid } from "../utils/spatial.js";
import { dst } from "../utils/math.js";
import { closeStationUi } from "../dock.js";
import { updateCamera } from "../utils/camera.js";
import { setWorldView } from "../render/world-text.js";
import { viewCenterX, viewCenterY } from "../render/viewport.js";
import { updateIndustryProgress } from "../ui/station/industry.js";
import { syncPixiCrosshair } from "../render/pixi-crosshair.js";

// Cached damage flash gradients (keyed by color, invalidated on viewport resize)
let damageFlashWc = 0;
let damageFlashHc = 0;
const damageFlashCache = new Map<string, CanvasGradient>();

// ─── Cached DOM refs ─────────────────────────────────────────────────────────
let _cachedMapWinBody: HTMLElement | null = null;
let _cachedMapWinRect: DOMRect | null = null;
let _lastMapOpen = false;
let _filterLogged = false;

// ─── Frame timing helper ─────────────────────────────────────────────────────
let _timingLabels: string[] = [];
let _timingVals: number[] = [];

function timeMark(label: string): void {
  if (typeof performance !== "undefined") {
    _timingLabels.push(label);
    _timingVals.push(performance.now());
  }
}

function timeFlush(totalThresholdMs = 16): void {
  if (_timingVals.length < 2) { _timingLabels = []; _timingVals = []; return; }
  const total = _timingVals[_timingVals.length - 1] - _timingVals[0];
  if (total <= totalThresholdMs) { _timingLabels = []; _timingVals = []; return; }
  const parts: string[] = [];
  for (let i = 1; i < _timingVals.length; i++) {
    const dt = _timingVals[i] - _timingVals[i - 1];
    if (dt > 0.5) parts.push(`${_timingLabels[i]}:${dt.toFixed(1)}ms`);
  }
  console.log("[PERF] Slow frame", { total: `${total.toFixed(2)}ms`, parts: parts.join(" | ") });
  _timingLabels = [];
  _timingVals = [];
}

export function drawFrame(now: number, alpha: number, frameDt: number) {
  const width = W();
  const height = H();
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

  // Clear the front Canvas 2D layer so the Pixi background (behind it) is visible.
  ctx.clearRect(0, 0, width, height);
}

function drawStationState(now: number, width: number, height: number) {
  renderPixi();
  drawStationInterior(width, height, now);
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
  Client.mouseWorld.x = (Client.mouse.x - canvasLeft() - viewCX) / Client.zoom + camxR;
  Client.mouseWorld.y = (Client.mouse.y - canvasTop() - viewCY) / Client.zoom + camyR;

  updateViewportBounds(width, height, Client.zoom, camxR, camyR, 240);
  setWorldView(width, height, camxR, camyR, Client.zoom);
  timeMark("camera");

  // Update PixiJS world container camera transform
  if (worldContainer) {
    worldContainer.x = viewCX - camxR * Client.zoom;
    worldContainer.y = viewCY - camyR * Client.zoom;
    worldContainer.scale.set(Client.zoom);
    if (worldContainer.filterArea) {
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
  syncPixiTutorialMarkers(now, sys);
  timeMark("tutmarkers");
  syncPixiRegionBorders(now);
  timeMark("borders");
  syncPixiTutorialTrack(now);
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
  }
  _cachedMapWinRect = _cachedMapWinBody?.getBoundingClientRect() ?? null;
  if (_cachedMapWinRect) {
    syncPixiSystemMap(_cachedMapWinRect.width, _cachedMapWinRect.height, now);
  }
  timeMark("map");

  syncThrust(alpha, now);
  timeMark("thrust");
  syncPixiHUD(width, height, now);
  timeMark("hud");
  syncPixiTargetArrows(width, height, camxR, camyR, now);
  timeMark("tarrows");
  syncPixiTutorialGuideArrow(width, height, camxR, camyR, now);
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

  // Clear the front Canvas 2D layer so the Pixi world (behind it) is visible.
  ctx.clearRect(0, 0, width, height);

  // Canvas 2D map overlays sit above Pixi and are clipped to the map window body.
  if (_cachedMapWinRect) {
    drawPixiSystemMapCanvasOverlays(_cachedMapWinRect.width, _cachedMapWinRect.height, now);
  }
  timeMark("mapoverlays");

  // Minimap (always visible during gameplay)
  syncPixiMinimap(now);
  timeMark("minimap");

  if (player && ((player.warpTargetIdx ?? -1) >= 0 || (player.warpCooldown ?? 0) > 2.0)) {
    drawWarpScreen(width, height, now);
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

  timeFlush(16);
}

function drawDamageFlash(width: number, height: number) {
  const sGlow = getState().player.shieldHitGlow || 0;
  const hGlow = getState().player.hullHitGlow || 0;
  const strGlow = getState().player.structureHitGlow || 0;
  const dmgFlash = Math.max(sGlow, hGlow, strGlow);
  if (dmgFlash <= 0) return;

  let flashColor: string;
  if (strGlow > 0) flashColor = "238,28,28";
  else if (hGlow > 0) flashColor = "238,153,68";
  else flashColor = "68,204,255";

  if (damageFlashWc !== width || damageFlashHc !== height) {
    damageFlashCache.clear();
    damageFlashWc = width;
    damageFlashHc = height;
  }
  let grad = damageFlashCache.get(flashColor);
  if (!grad) {
    const cx = width / 2;
    const cy = height / 2;
    const diag = Math.hypot(width, height);
    grad = ctx.createRadialGradient(cx, cy, diag * 0.32, cx, cy, diag * 0.55);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, `rgb(${flashColor})`);
    damageFlashCache.set(flashColor, grad);
  }
  ctx.globalAlpha = dmgFlash * 0.28;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
}

function drawWaypoint() {
  if (!Client.waypoint || !getState().player) return;
  const { x, y } = Client.waypoint;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);

  ctx.save();
  ctx.globalAlpha = 0.5 + pulse * 0.3;
  ctx.strokeStyle = "#55aaff";
  ctx.lineWidth = 1.5;

  const sz = 8 + pulse * 2;
  ctx.beginPath();
  ctx.moveTo(x, y - sz);
  ctx.lineTo(x + sz, y);
  ctx.lineTo(x, y + sz);
  ctx.lineTo(x - sz, y);
  ctx.closePath();
  ctx.stroke();

  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#55aaff";
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(getState().player.x, getState().player.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}
