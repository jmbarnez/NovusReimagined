import { ENEMY_DEFS } from "../../../data/enemies.js";
import type { Enemy } from "../../../types/enemy.js";
import type { Asteroid } from "../../../types/asteroid.js";
import type { WreckPiece } from "../../../types/system.js";
import type { AutoTarget } from "../../../types/combat.js";
import { isAsteroidTarget, isWreckPieceTarget } from "../../../targeting.js";
import { isGateLockId } from "../../../utils/warp-gates.js";

/* ── Icon texture cache: type → data URL ── */
const _iconCache = new Map<string, string>();

export function getIconDataUrl(type: string): string {
  if (_iconCache.has(type)) return _iconCache.get(type)!;
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg || !cfg.path.length) {
    const empty = "";
    _iconCache.set(type, empty);
    return empty;
  }

  const size = 32;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const cx = c.getContext("2d")!;
  cx.clearRect(0, 0, size, size);

  // Center and scale the path to fit in the canvas
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of cfg.path) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const pw = maxX - minX || 1;
  const ph = maxY - minY || 1;
  const scale = Math.min((size - 4) / pw, (size - 4) / ph);
  const offX = (size - pw * scale) / 2 - minX * scale;
  const offY = (size - ph * scale) / 2 - minY * scale;

  cx.beginPath();
  for (let i = 0; i < cfg.path.length; i++) {
    const [px, py] = cfg.path[i];
    i === 0 ? cx.moveTo(px * scale + offX, py * scale + offY) : cx.lineTo(px * scale + offX, py * scale + offY);
  }
  cx.closePath();
  cx.fillStyle = cfg.fill;
  cx.fill();
  cx.strokeStyle = cfg.stroke;
  cx.lineWidth = 1;
  cx.stroke();

  const url = c.toDataURL();
  _iconCache.set(type, url);
  return url;
}

export function drawLiveTargetIcon(
  canvas: HTMLCanvasElement,
  t: Enemy | Asteroid | WreckPiece | AutoTarget,
  isAst: boolean,
  isPiece: boolean,
  isGate: boolean,
) {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  // Clear previous frame
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  let pts: [number, number][] = [];
  let angle = 0;

  if (isAst) {
    pts = ((t as Asteroid).shape as [number, number][]) || [];
    angle = (t as Asteroid).spinAngle ?? 0;
  } else if (isPiece) {
    pts = (t as WreckPiece).pts || [];
    angle = (t as WreckPiece).angle ?? 0;
  } else if (isGate) {
    pts = [[0, -16], [16, 0], [0, 16], [-16, 0]];
  } else {
    const enemy = t as Enemy;
    if (enemy.type) {
      const def = ENEMY_DEFS[enemy.type];
      pts = (def?.render?.path as [number, number][]) || [];
      angle = enemy.angle ?? 0;
    }
  }

  // Query active theme color from the computed styles of the parent lock-card
  const cardEl = canvas.closest(".lock-card");
  let strokeColor = isAst ? "#00d2ff" : isPiece ? "#94a3b8" : isGate ? "#66b8ff" : "#ff5522";
  if (cardEl) {
    const computed = getComputedStyle(cardEl);
    const themeColor = computed.getPropertyValue("--lc-theme").trim();
    if (themeColor) {
      strokeColor = themeColor;
    }
  }
  const fillColor = colorMixTranslucent(strokeColor, 0.12);

  if (pts.length > 0) {
    // Calculate dynamic scale & offset to center the shape
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const pw = maxX - minX || 1;
    const ph = maxY - minY || 1;
    const boxSize = 32; // Fits beautifully in 48x48 bounds
    const scale = Math.min(boxSize / pw, boxSize / ph);
    const cxOffset = -(minX + maxX) / 2;
    const cyOffset = -(minY + maxY) / 2;

    ctx2d.save();
    ctx2d.translate(canvas.width / 2, canvas.height / 2);
    ctx2d.rotate(angle);

    ctx2d.beginPath();
    // Apply offset first to center, then scale
    ctx2d.moveTo((pts[0][0] + cxOffset) * scale, (pts[0][1] + cyOffset) * scale);
    for (let i = 1; i < pts.length; i++) {
      ctx2d.lineTo((pts[i][0] + cxOffset) * scale, (pts[i][1] + cyOffset) * scale);
    }
    ctx2d.closePath();

    ctx2d.lineJoin = "round";
    ctx2d.lineWidth = 1.8;
    ctx2d.fillStyle = fillColor;
    ctx2d.fill();
    ctx2d.strokeStyle = strokeColor;
    ctx2d.stroke();

    ctx2d.restore();
  }
}

function colorMixTranslucent(color: string, alpha: number): string {
  color = color.trim();
  if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return `rgba(0, 210, 255, ${alpha})`;
}
