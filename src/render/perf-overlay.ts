
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { curSys, isVisible } from "../utils/game.js";
import { sfxBlip } from "../audio/procedural.js";
import { t } from "../utils/i18n.js";
import { app, pixiDpr } from "../pixi.js";
import { viewportH, viewportW } from "./viewport.js";
import { getPerfTimingSnapshot, type PerfTimingSnapshot } from "./perf-telemetry.js";
import { getSpatialGridPerf } from "../utils/spatial.js";

export interface PerformanceRenderContext {
  mode: string;
  multiplayerRole: string;
  renderScale: number;
  fpsLimit: number;
  devicePixelRatio: number;
  pixiResolution: number;
  viewportW: number;
  viewportH: number;
  renderedMegapixels: number;
  zoom: number;
}

export interface PerformanceTelemetrySnapshot {
  fps: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  avgTicks: number;
  sampledAtMs: number;
  entities: {
    bullets: number;
    enemyBullets: number;
    beams: number;
    particles: number;
    shockwaves: number;
    floatTexts: number;
    trails: number;
    wreckPieces: number;
    salvagePickups: number;
  };
  world: {
    enemies: number;
    visibleEnemies: number;
    asteroids: number;
    visibleAsteroids: number;
    cells: number;
    spatialEntities: number;
  };
  context: PerformanceRenderContext;
  timings: PerfTimingSnapshot;
  memory: {
    usedMB: number;
    totalMB: number;
    limitMB: number;
  } | null;
}

let _lastSampleTime = 0;
let _frameCount = 0;
let _frameTimeSum = 0;
let _frameTimeMin = Infinity;
let _frameTimeMax = 0;
let _ticksPerFrameSum = 0;

let _fps = 0;
let _avgMs = 0;
let _minMs = 0;
let _maxMs = 0;
let _avgTicks = 0;

let _perfEl: HTMLDivElement | null = null;
let _perfBody: HTMLDivElement | null = null;
let _advancedBtn: HTMLButtonElement | null = null;

function readMemoryTelemetry(): PerformanceTelemetrySnapshot["memory"] {
  const memory = (performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (!memory) return null;
  return {
    usedMB: memory.usedJSHeapSize / 1048576,
    totalMB: memory.totalJSHeapSize / 1048576,
    limitMB: memory.jsHeapSizeLimit / 1048576,
  };
}

export function getPerformanceTelemetrySnapshot(): PerformanceTelemetrySnapshot {
  const state = getState();
  const sys = curSys();
  const width = viewportW();
  const height = viewportH();
  const pixiResolution = app?.renderer?.resolution ?? pixiDpr;
  const enemies = sys?._liveEnemies ?? [];
  const asteroids = sys?._liveAsteroids ?? [];
  const visibleEnemies = Client.perfAdvanced
    ? enemies.reduce((count, enemy) => count + (isVisible(enemy.x, enemy.y, Math.max(28, enemy.sigRadius ?? 18) + 24) ? 1 : 0), 0)
    : 0;
  const visibleAsteroids = Client.perfAdvanced
    ? asteroids.reduce((count, asteroid) => count + (isVisible(asteroid.x, asteroid.y, asteroid.radius + 10) ? 1 : 0), 0)
    : 0;
  return {
    fps: _fps,
    avgMs: _avgMs,
    minMs: _minMs,
    maxMs: _maxMs,
    avgTicks: _avgTicks,
    sampledAtMs: _lastSampleTime,
    entities: {
      bullets: state.bullets.length,
      enemyBullets: state.enemyBullets.length,
      beams: state.beams.length,
      particles: state.particles.length,
      shockwaves: state.shockwaves.length,
      floatTexts: state.floatTexts.length,
      trails: state.trails.length,
      wreckPieces: state.wreckPieces.length,
      salvagePickups: state.salvagePickups.length,
    },
    world: {
      enemies: enemies.length,
      visibleEnemies,
      asteroids: asteroids.length,
      visibleAsteroids,
      cells: state.spatialGrid?.cells?.size ?? 0,
      spatialEntities: state.spatialGrid?.entities?.size ?? 0,
    },
    context: {
      mode: Client.mode,
      multiplayerRole: Client.multiplayerRole ?? "none",
      renderScale: Client.settings?.renderScale ?? 0,
      fpsLimit: Client.settings?.fpsLimit ?? 0,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      pixiResolution,
      viewportW: width,
      viewportH: height,
      renderedMegapixels: width * height * pixiResolution * pixiResolution / 1000000,
      zoom: Client.zoom,
    },
    timings: getPerfTimingSnapshot(),
    memory: readMemoryTelemetry(),
  };
}

function timingLabel(id: string): string {
  const key = `perf.section.${id}`;
  const translated = t(key);
  return translated === key ? id : translated;
}

function statsLine(label: string, latestMs: number, avgMs: number, p50Ms: number, p95Ms: number, maxMs: number): string {
  return `${label}: now ${latestMs.toFixed(2)}  avg ${avgMs.toFixed(2)}  p50 ${p50Ms.toFixed(2)}  p95 ${p95Ms.toFixed(2)}  max ${maxMs.toFixed(2)} ms`;
}

function ensurePerfWindow() {
  if (_perfEl) return;
  const el = document.createElement("div");
  el.className = "perf-window";
  el.innerHTML = `
    <div class="perf-head">
      <span class="perf-title">${t("perf.title")}</span>
      <span style="flex:1"></span>
      <button type="button" class="perf-toggle" title="${t("perf.advancedTitle")}">${t("perf.advanced")}</button>
      <button type="button" class="perf-close" title="${t("common.close")}">×</button>
    </div>
    <div class="perf-body"></div>
  `;
  document.body.appendChild(el);
  _perfBody = el.querySelector(".perf-body") as HTMLDivElement;
  _advancedBtn = el.querySelector(".perf-toggle") as HTMLButtonElement;
  _advancedBtn.addEventListener("click", () => {
    sfxBlip();
    Client.perfAdvanced = !Client.perfAdvanced;
  });
  el.querySelector(".perf-close")!.addEventListener("click", () => {
    sfxBlip();
    Client.showPerf = false;
    el.style.display = "none";
  });

  const head = el.querySelector(".perf-head") as HTMLDivElement;
  head.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest("button")) return;
    ev.preventDefault();
    const baseX = parseFloat(el.style.left) || 10;
    const baseY = parseFloat(el.style.top) || 22;
    const sx = ev.clientX;
    const sy = ev.clientY;
    const onMove = (mv: MouseEvent) => {
      el.style.left = `${baseX + (mv.clientX - sx)}px`;
      el.style.top = `${baseY + (mv.clientY - sy)}px`;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  _perfEl = el;
}

function renderAdvanced(snapshot: PerformanceTelemetrySnapshot): string {
  const context = snapshot.context;
  const timing = snapshot.timings;
  const timingRows = timing.sections
    .map((section) => `
      <tr>
        <td>${timingLabel(section.id)}</td>
        <td>${section.latestMs.toFixed(2)}</td>
        <td>${section.avgMs.toFixed(2)}</td>
        <td>${section.p50Ms.toFixed(2)}</td>
        <td>${section.p95Ms.toFixed(2)}</td>
        <td>${section.maxMs.toFixed(2)}</td>
      </tr>
    `)
    .join("");

  const fpsLimit = context.fpsLimit > 0 ? `${context.fpsLimit}` : t("perf.vsync");
  return `
    <div class="perf-advanced">
      <div class="perf-section-title">${t("perf.frameBudget")}</div>
      <div class="perf-line">${statsLine(
        t("perf.section.total"),
        timing.total.latestMs,
        timing.total.avgMs,
        timing.total.p50Ms,
        timing.total.p95Ms,
        timing.total.maxMs,
      )}</div>
      <div class="perf-line">${t("perf.samples")}: ${timing.frames}  ${t("perf.target")}: ${timing.frameBudgetMs.toFixed(2)} ms</div>
      <div class="perf-grid">
        <div>${t("perf.renderScale")}: ${context.renderScale.toFixed(1)}x</div>
        <div>DPR: ${context.devicePixelRatio.toFixed(2)}</div>
        <div>Pixi: ${context.pixiResolution.toFixed(2)}</div>
        <div>${t("perf.viewport")}: ${context.viewportW}x${context.viewportH}</div>
        <div>${t("perf.renderedPixels")}: ${context.renderedMegapixels.toFixed(2)} MP</div>
        <div>${t("perf.fpsLimit")}: ${fpsLimit}</div>
        <div>${t("perf.zoom")}: ${context.zoom.toFixed(2)}</div>
        <div>${t("perf.mode")}: ${context.mode}</div>
        <div>${t("perf.net")}: ${context.multiplayerRole}</div>
      </div>
      <div class="perf-section-title">${t("perf.worldCounts")}</div>
      <div class="perf-grid">
        <div>EN: ${snapshot.world.visibleEnemies}/${snapshot.world.enemies}</div>
        <div>AST: ${snapshot.world.visibleAsteroids}/${snapshot.world.asteroids}</div>
        <div>Cells: ${snapshot.world.cells}</div>
        <div>Grid: ${snapshot.world.spatialEntities}</div>
        <div>Sync: ${getSpatialGridPerf().lastSyncMs.toFixed(2)}ms</div>
        <div>B: ${snapshot.entities.bullets}</div>
        <div>EB: ${snapshot.entities.enemyBullets}</div>
        <div>BM: ${snapshot.entities.beams}</div>
        <div>PT: ${snapshot.entities.particles}</div>
        <div>SW: ${snapshot.entities.shockwaves}</div>
        <div>FT: ${snapshot.entities.floatTexts}</div>
        <div>TR: ${snapshot.entities.trails}</div>
        <div>WR: ${snapshot.entities.wreckPieces}</div>
        <div>PK: ${snapshot.entities.salvagePickups}</div>
      </div>
      <div class="perf-section-title">${t("perf.sections")}</div>
      <table class="perf-section-table">
        <thead>
          <tr>
            <th>${t("perf.section")}</th>
            <th>Now</th>
            <th>Avg</th>
            <th>P50</th>
            <th>P95</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>${timingRows}</tbody>
      </table>
    </div>
  `;
}

export function updatePerfOverlay(frameTimeSec: number, ticksThisFrame: number) {
  _frameCount++;
  _frameTimeSum += frameTimeSec;
  _frameTimeMin = Math.min(_frameTimeMin, frameTimeSec);
  _frameTimeMax = Math.max(_frameTimeMax, frameTimeSec);
  _ticksPerFrameSum += ticksThisFrame;

  const now = performance.now();
  if (now - _lastSampleTime >= 1000) {
    _fps = _frameCount;
    _avgMs = _frameCount > 0 ? (_frameTimeSum / _frameCount) * 1000 : 0;
    _minMs = _frameCount > 0 ? _frameTimeMin * 1000 : 0;
    _maxMs = _frameCount > 0 ? _frameTimeMax * 1000 : 0;
    _avgTicks = _frameCount > 0 ? _ticksPerFrameSum / _frameCount : 0;

    _frameCount = 0;
    _frameTimeSum = 0;
    _frameTimeMin = Infinity;
    _frameTimeMax = 0;
    _ticksPerFrameSum = 0;
    _lastSampleTime = now;
  }
}


export function drawPerfOverlay() {
  if (!Client.showPerf) {
    if (_perfEl) _perfEl.style.display = "none";
    return;
  }
  ensurePerfWindow();
  _perfEl!.style.display = "flex";
  _perfEl!.classList.toggle("advanced", Client.perfAdvanced);
  if (_advancedBtn) {
    _advancedBtn.textContent = Client.perfAdvanced ? t("perf.basic") : t("perf.advanced");
    _advancedBtn.classList.toggle("active", Client.perfAdvanced);
  }

  const snapshot = getPerformanceTelemetrySnapshot();
  const lines = [
    `FPS: ${snapshot.fps}  avg: ${snapshot.avgMs.toFixed(1)}ms  min: ${snapshot.minMs.toFixed(1)}ms  max: ${snapshot.maxMs.toFixed(1)}ms`,
    `Ticks/frame: ${snapshot.avgTicks.toFixed(1)}`,
    `Entities: B=${snapshot.entities.bullets} EB=${snapshot.entities.enemyBullets} BM=${snapshot.entities.beams} PT=${snapshot.entities.particles} FT=${snapshot.entities.floatTexts}`,
    `World: EN=${snapshot.world.enemies} AST=${snapshot.world.asteroids} Grid=${snapshot.world.spatialEntities} Cells=${snapshot.world.cells}`,
  ];

  if (snapshot.memory) {
    lines.push(
      `Memory: ${snapshot.memory.usedMB.toFixed(1)}MB / ${snapshot.memory.totalMB.toFixed(1)}MB  Limit: ${snapshot.memory.limitMB.toFixed(0)}MB`
    );
  }

  let html = lines.map((l, i) => `<div class="perf-line${i === 0 ? " perf-fps" : ""}">${l}</div>`).join("");
  if (Client.perfAdvanced) html += renderAdvanced(snapshot);
  const body = _perfBody as (HTMLDivElement & { _lastHtml?: string }) | null;
  if (body && body._lastHtml !== html) {
    body._lastHtml = html;
    body.innerHTML = html;
  }
}
