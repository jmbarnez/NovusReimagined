import { G, Client } from "../state.js";
import { curSys } from "../utils/game.js";
import { sfxBlip } from "../audio/procedural.js";

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
let _fpsEl: HTMLDivElement | null = null;

function ensurePerfWindow() {
  if (_perfEl) return;
  const el = document.createElement("div");
  el.className = "perf-window";
  el.innerHTML = `
    <div class="perf-head">
      <span class="perf-title">Performance</span>
      <span style="flex:1"></span>
      <button type="button" class="perf-close" title="Close">×</button>
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

export function drawFpsCounter() {
  const show = Client.settings?.fpsCounter ?? false;
  if (!show) {
    if (_fpsEl) _fpsEl.style.display = "none";
    return;
  }
  if (!_fpsEl) {
    const el = document.createElement("div");
    el.id = "fps-counter";
    el.style.cssText = [
      "position:fixed", "top:8px", "left:8px",
      "font:bold 11px ui-monospace,monospace",
      "color:rgba(255,255,255,0.75)",
      "background:rgba(0,0,0,0.45)",
      "padding:2px 7px", "border-radius:3px",
      "pointer-events:none", "z-index:9999",
      "letter-spacing:0.04em",
    ].join(";");
    document.body.appendChild(el);
    _fpsEl = el;
  }
  _fpsEl.style.display = "block";
  const color = _fps >= 55 ? "#88ff88" : _fps >= 30 ? "#ffcc44" : "#ff5533";
  _fpsEl.innerHTML = `<span style="color:${color}">${_fps}</span> fps`;
}

export function drawPerfOverlay() {
  if (!Client.showPerf) {
    if (_perfEl) _perfEl.style.display = "none";
    return;
  }
  ensurePerfWindow();
  _perfEl!.style.display = "flex";

  const lines = [
    `FPS: ${_fps}  avg: ${_avgMs.toFixed(1)}ms  min: ${_minMs.toFixed(1)}ms  max: ${_maxMs.toFixed(1)}ms`,
    `Ticks/frame: ${_avgTicks.toFixed(1)}`,
    `Entities: B=${G.bullets.length} EB=${G.enemyBullets.length} BM=${G.beams.length} PT=${G.particles.length} FT=${G.floatTexts.length}`,
    `World: EN=${curSys()?._liveEnemies?.length ?? 0} AST=${curSys()?._liveAsteroids?.length ?? 0} Cells=${G.spatialGrid?.cells?.size ?? 0}`,
  ];

  const mem = (performance as any).memory;
  if (mem) {
    lines.push(
      `Memory: ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB / ${(mem.totalJSHeapSize / 1048576).toFixed(1)}MB  Limit: ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)}MB`
    );
  }

  const html = lines.map((l, i) => `<div class="perf-line${i === 0 ? " perf-fps" : ""}">${l}</div>`).join("");
  if ((_perfBody as any)._lastHtml !== html) {
    (_perfBody as any)._lastHtml = html;
    _perfBody!.innerHTML = html;
  }
}
