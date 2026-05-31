import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { drawBackground } from "../render/background.js";
import { drawHUD, drawSystemMap, drawWarpScreen, drawTargetArrow, drawTutorialGuideArrow } from "../render/hud.js";
import {
  drawStations,
  drawStationTurrets,
  drawCrosshair,
  drawLensFlare,
} from "../render/world.js";
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
import { syncPixiTutorialMarkers, drawTutorialGatePulse } from "../render/pixi-tutorial-markers.js";
import { syncPixiRegionBorders } from "../render/pixi-region-borders.js";
import { syncPixiTutorialTrack } from "../render/pixi-tutorial-track.js";
import { syncPixiTutorialGates } from "../render/pixi-tutorial-gates.js";
import { curSys, updateViewportBounds } from "../utils/game.js";
import { dst } from "../utils/math.js";
import { undockStation } from "../dock.js";
import { updateCamera } from "../utils/camera.js";
import { setWorldView } from "../render/world-text.js";
import { viewCenterX, viewCenterY } from "../render/viewport.js";
import { updateIndustryProgress } from "../ui/station/industry.js";

// Cached damage flash gradients (keyed by color, invalidated on viewport resize)
let damageFlashWc = 0;
let damageFlashHc = 0;
const damageFlashCache = new Map<string, CanvasGradient>();

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

  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height, sys, now, Client.camx, Client.camy);
}

function drawStationState(now: number, width: number, height: number) {
  renderPixi();
  drawStationInterior(width, height, now);
  updateIndustryProgress();
  updateTutorialOverlay(width, height, now);
  drawPerfOverlay();
}

function drawSpaceState(now: number, alpha: number, frameDt: number, width: number, height: number, sys: System) {
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
  syncPixiParticles();
  syncPixiStations(now, sys);
  syncPixiEntities(alpha, now);
  syncPixiPlayer(alpha, now);
  syncPixiTrails();
  syncPixiPlanets(now);
  syncPixiCelestial(now, alpha, sys);
  syncPixiCombat(now, alpha, sys);
  syncPixiEffects(now, alpha, frameDt, sys);
  syncPixiAsteroids(now, alpha, sys);
  syncPixiHitEffects(now, alpha, sys);
  syncPixiTutorialMarkers(now);
  syncPixiRegionBorders(now);
  syncPixiTutorialTrack(now);
  syncPixiTutorialGates(now);
  syncThrust(alpha, now);
  updateVignette();
  renderPixi();

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  drawBackground(width, height, sys, now, camxR, camyR);

  ctx.save();
  ctx.translate(viewCX, viewCY);
  ctx.scale(Client.zoom, Client.zoom);
  ctx.translate(-camxR, -camyR);
  drawStations(now, sys);
  drawStationTurrets(now, sys);
  drawCrosshair();
  drawWaypoint();
  drawTutorialGatePulse(ctx, now, sys);
  ctx.restore();
  ctx.restore();

  drawLensFlare(width, height);
  drawDamageFlash(width, height);

  drawHUD(width, height, now);
  drawTargetArrow(width, height, camxR, camyR, now);
  drawTutorialGuideArrow(width, height, camxR, camyR, now);
  if (Client.showMap) drawSystemMap(width, height, now);
  const player = getState().player;
  if (player && ((player.warpTargetIdx ?? -1) >= 0 || (player.warpCooldown ?? 0) > 2.0)) drawWarpScreen(width, height, now);

  if (Client.stationOpen && Client.activeStation) {
    const station = Client.activeStation;
    if (dst(getState().player.x, getState().player.y, station.x, station.y) > station.radius * 4) {
      undockStation();
    }
  }

  if (!Client.stationOpen) updateHudOverlay(width, height, now);
  updateIndustryProgress();
  updateTutorialOverlay(width, height, now);
  drawPerfOverlay();
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
