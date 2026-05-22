import "../styles/hud-lock-rail.css";
import { G } from "../../state.js";
import { PlayerAccess } from "../../state-access.js";
import { sfxBlip } from "../../audio/procedural.js";
import { dst } from "../../utils/math.js";
import { hudState } from "./state.js";
import type { Enemy, Asteroid, WreckPiece, LockSlot } from "../../types/world.js";
import type { ComputedStats } from "../../player/player-stats.js";

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
  removeSensorLock,
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

function drawLiveTargetIcon(canvas: HTMLCanvasElement, t: Enemy | Asteroid | WreckPiece, isAst: boolean, isPiece: boolean) {
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
  let strokeColor = isAst ? "#00d2ff" : isPiece ? "#94a3b8" : "#ff5522";
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

/* ── Lock Rail ── */
export function updateLockRail(st: ComputedStats, now: number) {
  ensureLockQueue();
  const queue = G.P.lockQueue;
  const primaryId = G.P.targetLock?.id;

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
  const el = document.createElement("div");
  el.className = "lock-card";
  el.dataset.id = id;

  // 1. Hologram Viewport on the left
  const holoViewport = document.createElement("div");
  holoViewport.className = "lc-hologram-viewport";

  const canvas = document.createElement("canvas");
  canvas.className = "lc-canvas";
  canvas.width = 48;
  canvas.height = 48;
  holoViewport.appendChild(canvas);

  const holoGrid = document.createElement("div");
  holoGrid.className = "lc-hologram-grid";
  holoViewport.appendChild(holoGrid);

  el.appendChild(holoViewport);

  // 2. Content Area on the right
  const contentArea = document.createElement("div");
  contentArea.className = "lc-content-area";

  // Header row inside content area
  const header = document.createElement("div");
  header.className = "lc-header";

  const level = document.createElement("div");
  level.className = "lc-level";
  header.appendChild(level);

  const name = document.createElement("div");
  name.className = "lc-name";
  header.appendChild(name);

  const targetInd = document.createElement("div");
  targetInd.className = "lc-target";
  header.appendChild(targetInd);

  contentArea.appendChild(header);

  // Body inside content area
  const body = document.createElement("div");
  body.className = "lc-body";

  // Telemetry row (visible when resolved)
  const telemetry = document.createElement("div");
  telemetry.className = "lc-telemetry";

  const spdMetric = document.createElement("div");
  spdMetric.className = "lc-metric";
  telemetry.appendChild(spdMetric);

  const distMetric = document.createElement("div");
  distMetric.className = "lc-metric";
  telemetry.appendChild(distMetric);

  const sigMetric = document.createElement("div");
  sigMetric.className = "lc-metric";
  telemetry.appendChild(sigMetric);

  const trsMetric = document.createElement("div");
  trsMetric.className = "lc-metric";
  telemetry.appendChild(trsMetric);

  body.appendChild(telemetry);

  // Telemetry details / backup labels
  const meta = document.createElement("div");
  meta.className = "lc-meta";
  body.appendChild(meta);

  // Scan progress (resolving state)
  const scan = document.createElement("div");
  scan.className = "lc-scan";
  body.appendChild(scan);

  contentArea.appendChild(body);
  el.appendChild(contentArea);

  // 3. Health bars (visible when resolved, spanning full bottom)
  const bars = document.createElement("div");
  bars.className = "lc-bars";

  // Shield bar
  const shieldBar = document.createElement("div");
  shieldBar.className = "lc-bar shield";
  const shieldInner = document.createElement("span");
  const shieldLabel = document.createElement("div");
  shieldLabel.className = "lc-bar-label";
  shieldBar.appendChild(shieldInner);
  shieldBar.appendChild(shieldLabel);
  bars.appendChild(shieldBar);

  // Hull (HP) bar
  const hpBar = document.createElement("div");
  hpBar.className = "lc-bar hp";
  const hpInner = document.createElement("span");
  const hpLabel = document.createElement("div");
  hpLabel.className = "lc-bar-label";
  hpBar.appendChild(hpInner);
  hpBar.appendChild(hpLabel);
  bars.appendChild(hpBar);

  // Structure bar
  const structBar = document.createElement("div");
  structBar.className = "lc-bar struct";
  const structInner = document.createElement("span");
  const structLabel = document.createElement("div");
  structLabel.className = "lc-bar-label";
  structBar.appendChild(structInner);
  structBar.appendChild(structLabel);
  bars.appendChild(structBar);

  el.appendChild(bars);

  // 4. Badges / overlays (absolute positioned over base container)
  const assign = document.createElement("div");
  assign.className = "lc-assign";
  el.appendChild(assign);

  const close = document.createElement("div");
  close.className = "lc-close";
  close.textContent = "×";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    sfxBlip();
    removeSensorLock(id);
  });
  el.appendChild(close);

  el.addEventListener("click", () => {
    sfxBlip();
    if (G.P._assignTargetId === id) {
      PlayerAccess.setAssignTargetId(null);
    } else {
      PlayerAccess.setAssignTargetId(id);
    }
  });

  hudState.lockRail!.appendChild(el);
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

export function updateLockCard(card: LockCard, slot: LockSlot, t: Enemy | Asteroid | WreckPiece, st: ComputedStats, now: number, primaryId: string | null | undefined) {
  const {
    el, headerEl, iconEl, canvasEl, nameEl, levelEl, targetIndEl,
    barsEl, shieldInner, shieldLabel, hpInner, hpLabel, structInner, structLabel,
    telemetryEl, spdMetric, distMetric, sigMetric, trsMetric,
    metaEl, scanEl, assignEl,
  } = card;

  const isAst = isAsteroidTarget(t.id);
  const isPiece = isWreckPieceTarget(t.id);
  const isPrimary = t.id === primaryId;
  const isResolved = !slot.resolving;
  const isEnemy = !isAst && !isPiece;

  const enemy = isEnemy ? (t as Enemy) : null;

  const isAssigned = G.P._assignTargetId === t.id;

  // Toggle resolved class with advanced retro context classes
  const targetLockClass = enemy && enemy.hasLockOnPlayer ? " target-locked" : enemy && enemy.targetingPlayer ? " target-targeting" : "";
  const enemyClass = isEnemy ? ` enemy${targetLockClass}` : "";
  const resolvedClass = `lock-card${isPrimary ? " primary" : ""}${isAssigned ? " assigned" : ""}${isAst ? " asteroid" : ""}${isPiece ? " wreck" : ""}${isResolved ? " resolved" : ""}${enemyClass}`;
  if (el.className !== resolvedClass) el.className = resolvedClass;

  // Name
  const nameText = (t.name || "Unknown").slice(0, 16);
  if (nameEl.textContent !== nameText) nameEl.textContent = nameText;

  if (isResolved) {
    // ── Resolved: draw live icon ──
    canvasEl.style.display = "";
    drawLiveTargetIcon(canvasEl, t, isAst, isPiece);

    // Level
    if (isEnemy && enemy) {
      if (!enemy.level) enemy.level = computeEnemyLevel(enemy);
      const lvlText = String(enemy.level);
      if (levelEl.textContent !== lvlText) levelEl.textContent = lvlText;

      // Targeting indicator
      if (enemy.hasLockOnPlayer) {
        targetIndEl.textContent = "▼";
        targetIndEl.style.color = "var(--hud-danger)";
        targetIndEl.style.display = "block";
      } else if (enemy.targetingPlayer) {
        targetIndEl.textContent = "▽";
        targetIndEl.style.color = "var(--hud-accent)";
        targetIndEl.style.display = "block";
      } else {
        targetIndEl.style.display = "none";
      }
    } else {
      levelEl.textContent = "";
      targetIndEl.style.display = "none";
    }

    // Health bars
    // Shield
    const maxSh = enemy?.maxShield || 0;
    const curSh = enemy?.shield || 0;
    const shPct = maxSh > 0 ? curSh / maxSh : 0;
    shieldInner.style.width = `${shPct * 100}%`;
    shieldLabel.textContent = maxSh > 0 ? `${Math.round(shPct * 100)}%` : "0%";

    // Hull (HP)
    const hpFrac = Math.max(0, Math.min(1, t.hp / Math.max(1, t.maxHp)));
    hpInner.style.width = `${hpFrac * 100}%`;
    hpLabel.textContent = `${Math.round(hpFrac * 100)}%`;

    // Structure
    const maxSt = enemy?.maxStructure || 0;
    const curSt = enemy?.structure || 0;
    const stPct = maxSt > 0 ? curSt / maxSt : 0;
    structInner.style.width = `${stPct * 100}%`;
    structLabel.textContent = maxSt > 0 ? `${Math.round(stPct * 100)}%` : "0%";

    // Telemetry Matrix
    const d = Math.round(dst(G.P.x, G.P.y, t.x, t.y));
    const speed = isAst ? 0 : Math.round(Math.hypot(t.vx || 0, t.vy || 0));
    const trs = enemy ? Math.round(transversalVs(enemy)) : 0;
    const sig = Math.round(enemy ? (enemy.sigRadius || 30) : (t.radius || 30));
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

    if (spdMetric.innerHTML !== spdHtml) spdMetric.innerHTML = spdHtml;
    if (distMetric.innerHTML !== distHtml) distMetric.innerHTML = distHtml;
    if (sigMetric.innerHTML !== sigHtml) sigMetric.innerHTML = sigHtml;
    if (trsMetric.innerHTML !== trsHtml) trsMetric.innerHTML = trsHtml;

    // Meta label text
    const metaText = isAst ? "ASTEROID" : isPiece ? "DEBRIS" : enemy ? enemyClassLabel(enemy.type) : "UNKNOWN";
    if (metaEl.textContent !== metaText) metaEl.textContent = metaText;

    if (scanEl.style.display !== "none") scanEl.style.display = "none";

  } else {
    /* ── Resolving: scan progress bar ── */
    canvasEl.style.display = "none";
    levelEl.textContent = "";
    targetIndEl.style.display = "none";

    // Scan progress
    const need = computeLockTimeSec(t, st);
    const pct = Math.min(1, (slot.acc || 0) / Math.max(0.05, need));
    hpInner.style.width = `${pct * 100}%`;
    hpLabel.textContent = `${Math.round(pct * 100)}%`;
    shieldInner.style.width = "0%";
    shieldLabel.textContent = "0%";
    structInner.style.width = "0%";
    structLabel.textContent = "0%";

    const scanText = `SCANNING...`;
    if (scanEl.textContent !== scanText) scanEl.textContent = scanText;
    if (scanEl.style.display !== "block") scanEl.style.display = "block";

    spdMetric.innerHTML = "";
    distMetric.innerHTML = "";
    sigMetric.innerHTML = "";
    trsMetric.innerHTML = "";
    metaEl.textContent = "";
  }

  // Assigned slot badges
  let assignText = "";
  if (isPiece) {
    const assignedSalv: number[] = [];
    for (let hi = 0; hi < (G.P.highTargets?.length || 0); hi++) {
      if (G.P.highTargets[hi] === t.id) assignedSalv.push(hi + 1);
    }
    assignText = assignedSalv.length ? `S${assignedSalv.join(",")}` : "";
  } else {
    const assignedTurrets: number[] = [];
    for (let ti = 0; ti < (G.P.turretTargets?.length || 0); ti++) {
      if (G.P.turretTargets[ti] === t.id) assignedTurrets.push(ti + 1);
    }
    assignText = assignedTurrets.length ? assignedTurrets.join(",") : "";
  }
  if (assignEl.textContent !== assignText) assignEl.textContent = assignText;
}
