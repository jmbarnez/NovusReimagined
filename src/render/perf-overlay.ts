
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { sfxBlip } from "../audio/procedural.js";
import { t } from "../utils/i18n.js";

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

  const state = getState();
  const lines = [
    `FPS: ${_fps}  avg: ${_avgMs.toFixed(1)}ms  min: ${_minMs.toFixed(1)}ms  max: ${_maxMs.toFixed(1)}ms`,
    `Ticks/frame: ${_avgTicks.toFixed(1)}`,
    `Entities: B=${state.bullets.length} EB=${state.enemyBullets.length} BM=${state.beams.length} PT=${state.particles.length} FT=${state.floatTexts.length}`,
    `World: EN=${curSys()?._liveEnemies?.length ?? 0} AST=${curSys()?._liveAsteroids?.length ?? 0} Cells=${state.spatialGrid?.cells?.size ?? 0}`,
  ];

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (mem) {
    lines.push(
      `Memory: ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB / ${(mem.totalJSHeapSize / 1048576).toFixed(1)}MB  Limit: ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)}MB`
    );
  }

  const html = lines.map((l, i) => `<div class="perf-line${i === 0 ? " perf-fps" : ""}">${l}</div>`).join("");
  const body = _perfBody as (HTMLDivElement & { _lastHtml?: string }) | null;
  if (body && body._lastHtml !== html) {
    body._lastHtml = html;
    body.innerHTML = html;
  }
}
