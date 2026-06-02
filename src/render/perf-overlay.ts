
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { sfxBlip } from "../audio/procedural.js";
import { t } from "../utils/i18n.js";

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
    floatTexts: number;
  };
  world: {
    enemies: number;
    asteroids: number;
    cells: number;
  };
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
      floatTexts: state.floatTexts.length,
    },
    world: {
      enemies: sys?._liveEnemies?.length ?? 0,
      asteroids: sys?._liveAsteroids?.length ?? 0,
      cells: state.spatialGrid?.cells?.size ?? 0,
    },
    memory: readMemoryTelemetry(),
  };
}

function ensurePerfWindow() {
  if (_perfEl) return;
  const el = document.createElement("div");
  el.className = "perf-window";
  el.innerHTML = `
    <div class="perf-head">
      <span class="perf-title">${t("perf.title")}</span>
      <span style="flex:1"></span>
      <button type="button" class="perf-close" title="${t("common.close")}">×</button>
    </div>
    <div class="perf-body"></div>
  `;
  document.body.appendChild(el);
  _perfBody = el.querySelector(".perf-body") as HTMLDivElement;
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

  const snapshot = getPerformanceTelemetrySnapshot();
  const lines = [
    `FPS: ${snapshot.fps}  avg: ${snapshot.avgMs.toFixed(1)}ms  min: ${snapshot.minMs.toFixed(1)}ms  max: ${snapshot.maxMs.toFixed(1)}ms`,
    `Ticks/frame: ${snapshot.avgTicks.toFixed(1)}`,
    `Entities: B=${snapshot.entities.bullets} EB=${snapshot.entities.enemyBullets} BM=${snapshot.entities.beams} PT=${snapshot.entities.particles} FT=${snapshot.entities.floatTexts}`,
    `World: EN=${snapshot.world.enemies} AST=${snapshot.world.asteroids} Cells=${snapshot.world.cells}`,
  ];

  if (snapshot.memory) {
    lines.push(
      `Memory: ${snapshot.memory.usedMB.toFixed(1)}MB / ${snapshot.memory.totalMB.toFixed(1)}MB  Limit: ${snapshot.memory.limitMB.toFixed(0)}MB`
    );
  }

  const html = lines.map((l, i) => `<div class="perf-line${i === 0 ? " perf-fps" : ""}">${l}</div>`).join("");
  const body = _perfBody as (HTMLDivElement & { _lastHtml?: string }) | null;
  if (body && body._lastHtml !== html) {
    body._lastHtml = html;
    body.innerHTML = html;
  }
}
