import "../styles/hud-lock-rail.css";

import { getState } from "../../state-access.js";
import { sfxBlip } from "../../audio/procedural.js";
import { dst } from "../../utils/math.js";
import { hudState } from "./state.js";
import { queueFrameAction } from "../../sim/input.js";
import type { Enemy, Asteroid, WreckPiece, LockSlot, AutoTarget } from "../../types/world.js";
import type { ComputedStats } from "../../player/player-stats.js";
import { createElement, append, setText, setHtml, setStyle, onClick, getStyleProperty } from "../dom-helpers.js";

export interface LockCard {
  el: HTMLElement;
  headerEl: HTMLElement;
  iconEl: HTMLCanvasElement;
  canvasEl: HTMLCanvasElement;
  nameEl: HTMLElement;
  levelEl: HTMLElement;
  targetIndEl: HTMLElement;
  barsEl: HTMLElement;
  shieldInner: HTMLElement;
  shieldLabel: HTMLElement;
  hpInner: HTMLElement;
  hpLabel: HTMLElement;
  structInner: HTMLElement;
  structLabel: HTMLElement;
  telemetryEl: HTMLElement;
  spdMetric: HTMLElement;
  distMetric: HTMLElement;
  sigMetric: HTMLElement;
  trsMetric: HTMLElement;
  metaEl: HTMLElement;
  scanEl: HTMLElement;
  assignEl: HTMLElement;
}
import {
  targetByLockId,
  isAsteroidTarget,
  isWreckPieceTarget,
  computeLockTimeSec,
  enemyClassLabel,
  transversalVs,
  ensureLockQueue,
  computeEnemyLevel,
} from "../../targeting.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { isGateLockId } from "../../utils/warp-gates.js";

/* ── Icon texture cache: type → data URL ── */
const _iconCache = new Map<string, string>();

function getIconDataUrl(type: string): string {
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

function drawLiveTargetIcon(canvas: HTMLCanvasElement, t: Enemy | Asteroid | WreckPiece | AutoTarget, isAst: boolean, isPiece: boolean, isGate: boolean) {
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

function targetSignalRadius(t: Enemy | Asteroid | WreckPiece | AutoTarget, enemy: Enemy | null): number {
  if (enemy) return enemy.sigRadius || 30;
  if ("sigRadius" in t && typeof t.sigRadius === "number") return t.sigRadius;
  if ("radius" in t && typeof t.radius === "number") return t.radius;
  return 30;
}

/* ── Lock Rail ── */
export function updateLockRail(st: ComputedStats, now: number) {
  ensureLockQueue();
  const queue = getState().player.lockQueue;
  const primaryId = getState().player.targetLock?.id;

  // Remove cards for targets no longer in queue
  for (const [id, card] of hudState.lockCards) {
    if (!queue.find((s: LockSlot) => s.id === id)) {
      card.el.remove();
      hudState.lockCards.delete(id);
    }
  }

  // Sync/update cards in order
  for (let i = 0; i < queue.length; i++) {
    const slot = queue[i];
    const t = targetByLockId(slot.id);
    if (!t) continue;

    let card = hudState.lockCards.get(slot.id);
    if (!card) {
      card = createLockCard(slot.id);
      hudState.lockCards.set(slot.id, card);
    }

    // Reorder if needed
    if (card.el !== hudState.lockRail!.children[i]) {
      hudState.lockRail!.insertBefore(card.el, hudState.lockRail!.children[i] || null);
    }

    updateLockCard(card, slot, t, st, now, primaryId);
  }

  // Remove trailing empty slots
  while (hudState.lockRail!.children.length > queue.length) {
    hudState.lockRail!.lastChild?.remove();
  }
}

export function createLockCard(id: string) {
  const el = createElement("div", "lock-card");
  el.dataset.id = id;

  // 1. Hologram Viewport on the left
  const holoViewport = createElement("div", "lc-hologram-viewport");

  const canvas = createElement("canvas", "lc-canvas") as HTMLCanvasElement;
  canvas.width = 48;
  canvas.height = 48;
  append(holoViewport, canvas);

  const holoGrid = createElement("div", "lc-hologram-grid");
  append(holoViewport, holoGrid);

  append(el, holoViewport);

  // 2. Content Area on the right
  const contentArea = createElement("div", "lc-content-area");

  // Header row inside content area
  const header = createElement("div", "lc-header");

  const level = createElement("div", "lc-level");
  append(header, level);

  const name = createElement("div", "lc-name");
  append(header, name);

  const targetInd = createElement("div", "lc-target");
  append(header, targetInd);

  append(contentArea, header);

  // Body inside content area
  const body = createElement("div", "lc-body");

  // Telemetry row (visible when resolved)
  const telemetry = createElement("div", "lc-telemetry");

  const spdMetric = createElement("div", "lc-metric");
  append(telemetry, spdMetric);

  const distMetric = createElement("div", "lc-metric");
  append(telemetry, distMetric);

  const sigMetric = createElement("div", "lc-metric");
  append(telemetry, sigMetric);

  const trsMetric = createElement("div", "lc-metric");
  append(telemetry, trsMetric);

  append(body, telemetry);

  // Telemetry details / backup labels
  const meta = createElement("div", "lc-meta");
  append(body, meta);

  // Scan progress (resolving state)
  const scan = createElement("div", "lc-scan");
  append(body, scan);

  append(contentArea, body);
  append(el, contentArea);

  // 3. Health bars (visible when resolved, spanning full bottom)
  const bars = createElement("div", "lc-bars");

  // Shield bar
  const shieldBar = createElement("div", "lc-bar shield");
  const shieldInner = createElement("span");
  const shieldLabel = createElement("div", "lc-bar-label");
  append(shieldBar, shieldInner);
  append(shieldBar, shieldLabel);
  append(bars, shieldBar);

  // Hull (HP) bar
  const hpBar = createElement("div", "lc-bar hp");
  const hpInner = createElement("span");
  const hpLabel = createElement("div", "lc-bar-label");
  append(hpBar, hpInner);
  append(hpBar, hpLabel);
  append(bars, hpBar);

  // Structure bar
  const structBar = createElement("div", "lc-bar struct");
  const structInner = createElement("span");
  const structLabel = createElement("div", "lc-bar-label");
  append(structBar, structInner);
  append(structBar, structLabel);
  append(bars, structBar);

  append(el, bars);

  // 4. Badges / overlays (absolute positioned over base container)
  const assign = createElement("div", "lc-assign");
  append(el, assign);

  const close = createElement("div", "lc-close");
  setText(close, "×");
  onClick(close, (e) => {
    (e as MouseEvent).stopPropagation();
    sfxBlip();
    queueFrameAction({ type: "removeSensorLock", payload: { id } });
  });
  append(el, close);

  onClick(el, () => {
    sfxBlip();
    queueFrameAction({ type: "selectLockTarget", payload: { id } });
  });

  append(hudState.lockRail!, el);
  return {
    el,
    headerEl: header,
    iconEl: canvas,
    canvasEl: canvas,
    nameEl: name,
    levelEl: level,
    targetIndEl: targetInd,
    barsEl: bars,
    shieldInner,
    shieldLabel,
    hpInner,
    hpLabel,
    structInner,
    structLabel,
    telemetryEl: telemetry,
    spdMetric,
    distMetric,
    sigMetric,
    trsMetric,
    metaEl: meta,
    scanEl: scan,
    assignEl: assign,
  };
}

export function updateLockCard(card: LockCard, slot: LockSlot, t: Enemy | Asteroid | WreckPiece | AutoTarget, st: ComputedStats, now: number, primaryId: string | null | undefined) {
  const {
    el, headerEl, iconEl, canvasEl, nameEl, levelEl, targetIndEl,
    barsEl, shieldInner, shieldLabel, hpInner, hpLabel, structInner, structLabel,
    telemetryEl, spdMetric, distMetric, sigMetric, trsMetric,
    metaEl, scanEl, assignEl,
  } = card;

  const isAst = isAsteroidTarget(t.id);
  const isPiece = isWreckPieceTarget(t.id);
  const isGate = isGateLockId(t.id);
  const isPrimary = t.id === primaryId;
  const isResolved = !slot.resolving;
  const isEnemy = !isAst && !isPiece && !isGate;

  const enemy = isEnemy ? (t as Enemy) : null;

  const isAssigned = getState().player._assignTargetId === t.id;

  // Toggle resolved class with advanced retro context classes
  const targetLockClass = enemy && enemy.hasLockOnPlayer ? " target-locked" : enemy && enemy.targetingPlayer ? " target-targeting" : "";
  const enemyClass = isEnemy ? ` enemy${targetLockClass}` : "";
  const resolvedClass = `lock-card${isPrimary ? " primary" : ""}${isAssigned ? " assigned" : ""}${isAst ? " asteroid" : ""}${isPiece ? " wreck" : ""}${isGate ? " gate" : ""}${isResolved ? " resolved" : ""}${enemyClass}`;
  if (el.className !== resolvedClass) el.className = resolvedClass;

  // Name
  const nameText = (t.name || "Unknown").slice(0, 16);
  if (nameEl.textContent !== nameText) setText(nameEl, nameText);

  if (isResolved) {
    // ── Resolved: draw live icon ──
    setStyle(canvasEl, { display: "" });
    drawLiveTargetIcon(canvasEl, t, isAst, isPiece, isGate);

    // Level
    if (isEnemy && enemy) {
      if (!enemy.level) enemy.level = computeEnemyLevel(enemy);
      const lvlText = String(enemy.level);
      if (levelEl.textContent !== lvlText) setText(levelEl, lvlText);

      // Targeting indicator
      if (enemy.hasLockOnPlayer) {
        setText(targetIndEl, "▼");
        setStyle(targetIndEl, { color: "var(--hud-danger)", display: "block" });
      } else if (enemy.targetingPlayer) {
        setText(targetIndEl, "▽");
        setStyle(targetIndEl, { color: "var(--hud-accent)", display: "block" });
      } else {
        setStyle(targetIndEl, { display: "none" });
      }
    } else {
      setText(levelEl, "");
      setStyle(targetIndEl, { display: "none" });
    }

    // Health bars
    // Shield
    const maxSh = enemy?.maxShield || 0;
    const curSh = enemy?.shield || 0;
    const shPct = maxSh > 0 ? curSh / maxSh : 0;
    setStyle(shieldInner, { width: `${shPct * 100}%` });
    setText(shieldLabel, maxSh > 0 ? `${Math.round(shPct * 100)}%` : "0%");

    // Hull (HP)
    const maxHp = "maxHp" in t && typeof t.maxHp === "number" ? t.maxHp : Math.max(1, t.hp);
    const hpFrac = Math.max(0, Math.min(1, t.hp / Math.max(1, maxHp)));
    setStyle(hpInner, { width: `${hpFrac * 100}%` });
    setText(hpLabel, `${Math.round(hpFrac * 100)}%`);

    // Structure
    const maxSt = enemy?.maxStructure || 0;
    const curSt = enemy?.structure || 0;
    const stPct = maxSt > 0 ? curSt / maxSt : 0;
    setStyle(structInner, { width: `${stPct * 100}%` });
    setText(structLabel, maxSt > 0 ? `${Math.round(stPct * 100)}%` : "0%");

    // Telemetry Matrix
    const d = Math.round(dst(getState().player.x, getState().player.y, t.x, t.y));
    const speed = (isAst || isGate) ? 0 : Math.round(Math.hypot(t.vx || 0, t.vy || 0));
    const trs = enemy ? Math.round(transversalVs(enemy)) : 0;
    const sig = Math.round(targetSignalRadius(t, enemy));
    const band = d < st.wProf.range ? "OPT" : "OFF";

    const spdHtml = `<span class="m-val">${speed}</span> m/s`;
    
    let distHtml = "";
    if (d < 2000) {
      distHtml = `<span class="m-val">${Math.round(d)}</span> m ${band}`;
    } else {
      const km = d / 1000;
      const kmStr = (Math.round(km * 10) % 10 === 0) ? Math.round(km).toString() : km.toFixed(1);
      distHtml = `<span class="m-val">${kmStr}</span> km ${band}`;
    }

    const sigHtml = `SIG <span class="m-val">${sig}</span>`;
    const trsHtml = `TRS <span class="m-val">${trs}</span>`;

    if (spdMetric.innerHTML !== spdHtml) setHtml(spdMetric, spdHtml);
    if (distMetric.innerHTML !== distHtml) setHtml(distMetric, distHtml);
    if (sigMetric.innerHTML !== sigHtml) setHtml(sigMetric, sigHtml);
    if (trsMetric.innerHTML !== trsHtml) setHtml(trsMetric, trsHtml);

    // Meta label text
    const metaText = isAst ? "ASTEROID" : isPiece ? "DEBRIS" : enemy ? enemyClassLabel(enemy.type) : "UNKNOWN";
    if (metaEl.textContent !== metaText) setText(metaEl, metaText);

    if (getStyleProperty(scanEl, "display") !== "none") setStyle(scanEl, { display: "none" });

  } else {
    /* ── Resolving: scan progress bar ── */
    setStyle(canvasEl, { display: "none" });
    setText(levelEl, "");
    setStyle(targetIndEl, { display: "none" });

    // Scan progress
    const need = computeLockTimeSec(t, st);
    const pct = Math.min(1, (slot.acc || 0) / Math.max(0.05, need));
    setStyle(hpInner, { width: `${pct * 100}%` });
    setText(hpLabel, `${Math.round(pct * 100)}%`);
    setStyle(shieldInner, { width: "0%" });
    setText(shieldLabel, "0%");
    setStyle(structInner, { width: "0%" });
    setText(structLabel, "0%");

    const scanText = `SCANNING...`;
    if (scanEl.textContent !== scanText) setText(scanEl, scanText);
    if (getStyleProperty(scanEl, "display") !== "block") setStyle(scanEl, { display: "block" });

    setHtml(spdMetric, "");
    setHtml(distMetric, "");
    setHtml(sigMetric, "");
    setHtml(trsMetric, "");
    setText(metaEl, "");
  }

  // Assigned slot badges
  let assignText = "";
  if (isPiece) {
    const assignedSalv: number[] = [];
    for (let hi = 0; hi < (getState().player.highTargets?.length || 0); hi++) {
      if (getState().player.highTargets[hi] === t.id) assignedSalv.push(hi + 1);
    }
    assignText = assignedSalv.length ? `S${assignedSalv.join(",")}` : "";
  } else {
    const assignedTurrets: number[] = [];
    for (let ti = 0; ti < (getState().player.turretTargets?.length || 0); ti++) {
      if (getState().player.turretTargets[ti] === t.id) assignedTurrets.push(ti + 1);
    }
    assignText = assignedTurrets.length ? assignedTurrets.join(",") : "";
  }
  if (assignEl.textContent !== assignText) setText(assignEl, assignText);
}
