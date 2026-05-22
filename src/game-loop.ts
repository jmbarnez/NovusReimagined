import { G, Client, AppMode } from "./state.js";
import type { System } from "./types/world.js";
import { savePlayer } from "./player/player-data.js";
import { drawBackground } from "./render/background.js";
import { drawHUD, drawGalaxyMap, drawSystemMap, drawWarpScreen, drawTargetArrow } from "./render/hud.js";
import {
  drawStar,
  drawGates, drawStations, drawStationTurrets, drawAsteroids, drawEnemyOverlays,
  drawBullets, drawBeams, drawMiningLaser, drawSalvagerBeam, drawTractorBeam, drawShockwaves, drawPlayer,
  drawCrosshair, drawFloatTexts, drawWreckPieces, drawSalvagePickups,
  drawWorldBorder, updateAndDrawImpactDecals, drawAmbientLife, drawLensFlare,
} from "./render/world.js";
import { syncPixiPlanets } from "./render/pixi-planets.js";
import { updateVignette } from "./render/pixi-vignette.js";
import { syncThrust } from "./render/pixi-thrust.js";
import { drawStationInterior } from "./render/station-interior.js";
import { updatePerfOverlay, drawPerfOverlay } from "./render/perf-overlay.js";
import { initHudOverlay, updateHudOverlay, destroyHudOverlay } from "./ui/hud-overlay.js";
import { tickCraftQueue } from "./ui/station/industry.js";
import { ctx, W, H, canvasLeft, canvasTop, disposeCanvas } from "./canvas.js";
import { renderPixi, app, worldContainer } from "./pixi.js";
import { initPixiBackground, updatePixiBackground } from "./render/pixi-background.js";
import { syncPixiParticles } from "./render/pixi-particles.js";
import { syncPixiEntities } from "./render/pixi-entities.js";
import { syncPixiPlayer, syncPixiTrails } from "./render/pixi-player.js";
import { syncPixiStations } from "./render/pixi-stations.js";
import { TICK_DT, MAX_CATCH, LOCK_RAIL_H } from "./constants.js";
import { curSys, updateViewportBounds } from "./utils/game.js";
import { tick } from "./physics.js";
import { updateCamera } from "./utils/camera.js";
import { setWorldView } from "./render/world-text.js";
import { viewCenterX, viewCenterY } from "./render/viewport.js";
import { drawAsteroidDebris } from "./utils/mining.js";

let accumulator = 0;
let lastFrameTime = performance.now();
let _gameStarted = false;
let autoSaveTimer = 0;

// Cached damage flash gradients (keyed by color, invalidated on viewport resize)
let _dmgFlashWc = 0, _dmgFlashHc = 0;
const _dmgFlashCache = new Map<string, CanvasGradient>();

const _ticker = new Worker(new URL('./worker/ticker.worker.js', import.meta.url));

_ticker.onmessage = () => {
  if (!_gameStarted || !document.hidden) return;

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.25);
  lastFrameTime = now;

  if (G.P && Client.mode === AppMode.SPACE && !Client.settingsOpen) {
    accumulator += dt;
    let ran = 0;
    while (accumulator >= TICK_DT && ran < MAX_CATCH) {
      tick(TICK_DT);
      accumulator -= TICK_DT;
      ran++;
    }
    if (accumulator > MAX_CATCH * TICK_DT) accumulator = MAX_CATCH * TICK_DT;
  }
};

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastFrameTime = performance.now();
    accumulator = 0;
  }
});

function loop(now: number) {
  requestAnimationFrame(loop);

  const frameTime = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  let ticks = 0;
  if (G.P && Client.mode === AppMode.SPACE && !Client.settingsOpen && !Client.stationOpen) {
    accumulator += frameTime;
    while (accumulator >= TICK_DT && ticks < MAX_CATCH) {
      tick(TICK_DT);
      accumulator -= TICK_DT;
      ticks++;
    }
    if (accumulator > MAX_CATCH * TICK_DT) accumulator = MAX_CATCH * TICK_DT;

    autoSaveTimer += frameTime;
    if (autoSaveTimer >= 30) {
      autoSaveTimer = 0;
      savePlayer();
    }
  } else {
    autoSaveTimer = 0;
    if (G.P && Client.mode === AppMode.SPACE && !Client.settingsOpen) {
      accumulator += frameTime;
      while (accumulator >= TICK_DT && ticks < MAX_CATCH) {
        tick(TICK_DT);
        accumulator -= TICK_DT;
        ticks++;
      }
      if (accumulator > MAX_CATCH * TICK_DT) accumulator = MAX_CATCH * TICK_DT;
    }
  }

  updatePerfOverlay(frameTime, ticks);

  if (G.P?.craftQueue?.length > 0) {
    tickCraftQueue();
  }

  const alpha = Client.stationOpen || Client.settingsOpen ? 1 : accumulator / TICK_DT;
  draw(now, alpha, frameTime);
}

function draw(now: number, alpha: number, frameDt: number) {
  const Wc = W();
  const Hc = H();
  const sys = curSys();
  if (!sys) return;

  switch (Client.mode) {
    case AppMode.TITLE:
      drawTitleState(now, Wc, Hc, sys);
      break;
    case AppMode.SPACE:
      drawSpaceState(now, alpha, frameDt, Wc, Hc, sys);
      break;
    case AppMode.STATION:
      drawStationState(now, Wc, Hc);
      break;
  }
}

function drawTitleState(now: number, Wc: number, Hc: number, sys: System) {
  // Slow cinematic camera pan
  Client.camx += 0.8;
  Client.camy += 0.4;

  updatePixiBackground(now, Client.camx, Client.camy);
  renderPixi();

  ctx.clearRect(0, 0, Wc, Hc);
  drawBackground(Wc, Hc, sys, now, Client.camx, Client.camy);
}

function drawStationState(now: number, Wc: number, Hc: number) {
  renderPixi();
  drawStationInterior(Wc, Hc, now);
  drawPerfOverlay();
}

function drawSpaceState(now: number, alpha: number, frameDt: number, Wc: number, Hc: number, sys: System) {
  // Camera locks to the interpolated player position — same alpha as the ship
  // sprite, so the player sits at a fixed screen point with zero relative
  // jitter. Camera position is independent of HUD layout; the playable area
  // is shaped by the canvas size (see canvas.ts) not the camera.
  updateCamera(alpha);
  const camxR = Client.camx;
  const camyR = Client.camy;
  const viewCX = viewCenterX(Wc);
  const viewCY = viewCenterY(Hc);
  // Client.mouse is in window coords; the canvas is inset below the lock-rail,
  // so shift into canvas-local space before projecting to the world.
  Client.mouseWorld.x = (Client.mouse.x - canvasLeft() - viewCX) / Client.zoom + camxR;
  Client.mouseWorld.y = (Client.mouse.y - canvasTop() - viewCY) / Client.zoom + camyR;

  updateViewportBounds(Wc, Hc, Client.zoom, camxR, camyR, 240);
  setWorldView(Wc, Hc, camxR, camyR, Client.zoom);

  // Update PixiJS world container camera transform
  if (worldContainer) {
    worldContainer.x = viewCX - camxR * Client.zoom;
    worldContainer.y = viewCY - camyR * Client.zoom;
    worldContainer.scale.set(Client.zoom);
    // filterArea is in worldContainer's LOCAL (world) coords — keep it tracking
    // the visible viewport so the colour-grade filter covers the entire screen
    // at every zoom level. (A fixed screen-pixel rect would clip when zoomed.)
    if (worldContainer.filterArea) {
      worldContainer.filterArea.x = camxR - viewCX / Client.zoom;
      worldContainer.filterArea.y = camyR - viewCY / Client.zoom;
      worldContainer.filterArea.width = Wc / Client.zoom;
      worldContainer.filterArea.height = Hc / Client.zoom;
    }
  }

  updatePixiBackground(now, camxR, camyR);
  syncPixiParticles();
  syncPixiStations(now, sys);
  syncPixiEntities(alpha, now);
  syncPixiPlayer(alpha, now);
  syncPixiTrails();
  syncPixiPlanets(now);
  syncThrust(alpha, now);
  updateVignette();
  renderPixi();

  // Canvas 2D overlay — transparent, renders on top of PixiJS
  ctx.clearRect(0, 0, Wc, Hc);

  ctx.save();
  drawBackground(Wc, Hc, sys, now, camxR, camyR);

  ctx.save();
  ctx.translate(viewCX, viewCY);
  ctx.scale(Client.zoom, Client.zoom);
  ctx.translate(-camxR, -camyR);

  drawStar(now, sys);
  drawWorldBorder();
  drawGates(now, alpha, sys);
  drawStations(now, sys);
  drawStationTurrets(now, sys);
  drawAsteroids(alpha, sys, now);
  drawAsteroidDebris();
  drawEnemyOverlays(alpha, sys, now);
  drawWreckPieces(now);
  drawSalvagePickups(now);
  drawBullets(alpha, sys);
  drawBeams(sys);
  drawMiningLaser(now);
  drawSalvagerBeam();
  drawTractorBeam();
  drawShockwaves();
  drawPlayer(now, alpha);
  drawCrosshair();
  drawFloatTexts(sys);
  drawWaypoint();

  ctx.restore();

  // The canvas itself is the playable rect (inset between the HUD bars, see
  // canvas.ts), so world content is bounded by the canvas edges. HUD-space
  // overlays (damage flash, target arrow) draw across that rect after this.
  ctx.restore();

  drawLensFlare(Wc, Hc);

  const sGlow = G.P.shieldHitGlow || 0;
  const hGlow = G.P.hullHitGlow || 0;
  const strGlow = G.P.structureHitGlow || 0;
  const dmgFlash = Math.max(sGlow, hGlow, strGlow);
  if (dmgFlash > 0) {
    let flashColor: string;
    if (strGlow > 0) flashColor = "238,28,28";
    else if (hGlow > 0) flashColor = "238,153,68";
    else flashColor = "68,204,255";
    // Viewport-resize invalidation
    if (_dmgFlashWc !== Wc || _dmgFlashHc !== Hc) {
      _dmgFlashCache.clear();
      _dmgFlashWc = Wc;
      _dmgFlashHc = Hc;
    }
    let grad = _dmgFlashCache.get(flashColor);
    if (!grad) {
      const cx = Wc / 2, cy = Hc / 2;
      const diag = Math.hypot(Wc, Hc);
      grad = ctx.createRadialGradient(cx, cy, diag * 0.32, cx, cy, diag * 0.55);
      grad.addColorStop(0, "transparent");
      // Bake max alpha — modulate per-frame via globalAlpha instead
      grad.addColorStop(1, `rgb(${flashColor})`);
      _dmgFlashCache.set(flashColor, grad);
    }
    ctx.globalAlpha = dmgFlash * 0.28;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, Wc, Hc);
    ctx.globalAlpha = 1;
  }

  drawHUD(Wc, Hc, now);
  drawTargetArrow(Wc, Hc, camxR, camyR, now);
  if (Client.showMap) {
    if (Client.showSystemMap) drawSystemMap(Wc, Hc);
    else drawGalaxyMap(Wc, Hc);
  }
  if (G.warpTargetIdx >= 0 || G.warpCooldown > 2.0) drawWarpScreen(Wc, Hc, now);

  if (!Client.stationOpen) updateHudOverlay(Wc, Hc, now);


  drawPerfOverlay();
}

export function initGameLoop() {
  _gameStarted = true;
  lastFrameTime = performance.now();
  accumulator = 0;
  requestAnimationFrame(loop);
}

export function enterSpaceMode() {
  Client.mode = AppMode.SPACE;
  Client.gameStarted = true;
  initHudOverlay();
  const hud = document.getElementById("hud-overlay");
  if (hud) hud.style.display = "block";
  window.dispatchEvent(new Event("resize"));
}

export function stopGameLoop() {
  _gameStarted = false;
  try { _ticker.postMessage({ type: "stop" }); } catch {}
  _ticker.terminate();
  disposeCanvas();
}

// Dispose worker + listeners on HMR reload so dev sessions don't accumulate duplicates.
const _meta = import.meta as ImportMeta & { hot?: { dispose: (cb: () => void) => void } };
if (_meta.hot) {
  _meta.hot.dispose(() => {
    stopGameLoop();
    destroyHudOverlay();
  });
}

function drawWaypoint() {
  if (!Client.waypoint || !G.P) return;
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
  ctx.moveTo(G.P.x, G.P.y);
  ctx.lineTo(x, y);
  ctx.stroke();

  ctx.restore();
}
