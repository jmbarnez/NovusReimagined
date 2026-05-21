import "../styles/hud-lock-rail.css";
import { G } from "../../state.js";
import { sfxBlip } from "../../audio/procedural.js";
import { dst } from "../../utils/math.js";
import { hudState } from "./state.js";
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

/* ── Lock Rail ── */
export function updateLockRail(st: any, now: number) {
  ensureLockQueue();
  const queue = G.P.lockQueue;
  const primaryId = G.P.targetLock?.id;

  // Remove cards for targets no longer in queue
  for (const [id, card] of hudState.lockCards) {
    if (!queue.find((s: any) => s.id === id)) {
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

  // Header row (visible when resolved)
  const header = document.createElement("div");
  header.className = "lc-header";

  const icon = document.createElement("img");
  icon.className = "lc-icon";
  icon.alt = "";
  header.appendChild(icon);

  const name = document.createElement("div");
  name.className = "lc-name";
  header.appendChild(name);

  const level = document.createElement("div");
  level.className = "lc-level";
  header.appendChild(level);

  const targetInd = document.createElement("div");
  targetInd.className = "lc-target";
  header.appendChild(targetInd);

  el.appendChild(header);

  // Health bars (visible when resolved)
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

  el.appendChild(telemetry);

  // Meta (for asteroids / debris)
  const meta = document.createElement("div");
  meta.className = "lc-meta";
  el.appendChild(meta);

  // Scan progress (resolving state)
  const scan = document.createElement("div");
  scan.className = "lc-scan";
  el.appendChild(scan);

  // Assign slot badge
  const assign = document.createElement("div");
  assign.className = "lc-assign";
  el.appendChild(assign);

  // Close button
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
      G.P._assignTargetId = null;
    } else {
      G.P._assignTargetId = id;
    }
  });

  hudState.lockRail!.appendChild(el);
  return {
    el,
    headerEl: header,
    iconEl: icon,
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

export function updateLockCard(card: any, slot: any, t: any, st: any, now: number, primaryId: string | null | undefined) {
  const {
    el, headerEl, iconEl, nameEl, levelEl, targetIndEl,
    barsEl, shieldInner, shieldLabel, hpInner, hpLabel, structInner, structLabel,
    telemetryEl, spdMetric, distMetric, sigMetric, trsMetric,
    metaEl, scanEl, assignEl,
  } = card;

  const isAst = isAsteroidTarget(t.id);
  const isPiece = isWreckPieceTarget(t.id);
  const isPrimary = t.id === primaryId;
  const isResolved = !slot.resolving;

  // Toggle resolved class
  const resolvedClass = `lock-card${isPrimary ? " primary" : ""}${isAst ? " asteroid" : ""}${isPiece ? " wreck" : ""}${isResolved ? " resolved" : ""}`;
  if (el.className !== resolvedClass) el.className = resolvedClass;

  // Assign border highlight
  const assignBorder = G.P._assignTargetId === t.id ? "rgba(80,220,255,0.9)" : "";
  if (el.style.borderColor !== assignBorder) el.style.borderColor = assignBorder;

  // Name
  const nameText = (t.name || "Unknown").slice(0, 16);
  if (nameEl.textContent !== nameText) nameEl.textContent = nameText;

  if (isResolved && !isAst && !isPiece) {
    /* ── Resolved enemy: full info ── */

    // Icon
    const iconUrl = getIconDataUrl(t.type || "");
    if (iconUrl && iconEl.src !== iconUrl) iconEl.src = iconUrl;
    if (!iconUrl) iconEl.style.display = "none";
    else if (iconEl.style.display === "none") iconEl.style.display = "";

    // Level
    if (!t.level) t.level = computeEnemyLevel(t);
    const lvlText = `L${t.level}`;
    if (levelEl.textContent !== lvlText) levelEl.textContent = lvlText;

    // Targeting indicator
    if (t.hasLockOnPlayer) {
      targetIndEl.textContent = "▼";
      targetIndEl.style.color = "#ff4444";
      targetIndEl.style.display = "block";
    } else if (t.targetingPlayer) {
      targetIndEl.textContent = "▽";
      targetIndEl.style.color = "#ffcc44";
      targetIndEl.style.display = "block";
    } else {
      targetIndEl.style.display = "none";
    }

    // Shield bar
    const maxSh = t.maxShield || 0;
    const curSh = t.shield || 0;
    const shPct = maxSh > 0 ? curSh / maxSh : 0;
    shieldInner.style.width = `${shPct * 100}%`;
    shieldLabel.textContent = maxSh > 0 ? `${Math.round(shPct * 100)}%` : "";

    // Hull bar
    const hpFrac = Math.max(0, Math.min(1, t.hp / Math.max(1, t.maxHp)));
    hpInner.style.width = `${hpFrac * 100}%`;
    hpLabel.textContent = `${Math.round(hpFrac * 100)}%`;

    // Structure bar
    const maxSt = t.maxStructure || 0;
    const curSt = t.structure || 0;
    const stPct = maxSt > 0 ? curSt / maxSt : 0;
    structInner.style.width = `${stPct * 100}%`;
    structLabel.textContent = maxSt > 0 ? `${Math.round(stPct * 100)}%` : "";

    // Telemetry
    const d = Math.round(dst(G.P.x, G.P.y, t.x, t.y));
    const speed = Math.round(Math.hypot(t.vx || 0, t.vy || 0));
    const trs = Math.round(transversalVs(t));
    const sig = Math.round(t.sigRadius || 30);
    const band = d < st.wProf.range ? "OPT" : "OFF";

    const spdHtml = `<span class="m-val">${speed}</span> m/s`;
    const distHtml = `<span class="m-val">${d}</span> m ${band}`;
    const sigHtml = `SIG <span class="m-val">${sig}</span>`;
    const trsHtml = `TRS <span class="m-val">${trs}</span>`;

    if (spdMetric.innerHTML !== spdHtml) spdMetric.innerHTML = spdHtml;
    if (distMetric.innerHTML !== distHtml) distMetric.innerHTML = distHtml;
    if (sigMetric.innerHTML !== sigHtml) sigMetric.innerHTML = sigHtml;
    if (trsMetric.innerHTML !== trsHtml) trsMetric.innerHTML = trsHtml;

    // Scan hidden
    if (scanEl.style.display !== "none") scanEl.style.display = "none";

  } else if (isResolved && (isAst || isPiece)) {
    /* ── Resolved asteroid / debris: simplified info ── */

    iconEl.style.display = "none";
    levelEl.textContent = "";
    targetIndEl.style.display = "none";

    // Single HP bar for asteroids/debris
    const hpFrac = Math.max(0, Math.min(1, t.hp / Math.max(1, t.maxHp)));
    hpInner.style.width = `${hpFrac * 100}%`;
    hpLabel.textContent = `${Math.round(hpFrac * 100)}%`;
    shieldInner.style.width = "0%";
    shieldLabel.textContent = "";
    structInner.style.width = "0%";
    structLabel.textContent = "";

    // Telemetry
    const d = Math.round(dst(G.P.x, G.P.y, t.x, t.y));
    const distHtml = `<span class="m-val">${d}</span> m`;
    if (distMetric.innerHTML !== distHtml) distMetric.innerHTML = distHtml;
    spdMetric.innerHTML = "";
    sigMetric.innerHTML = "";
    trsMetric.innerHTML = "";

    // Meta for asteroids/debris
    if (isAst) {
      metaEl.textContent = `AST  HP ${Math.round(hpFrac * 100)}%`;
    } else {
      metaEl.textContent = `DEBRIS  HP ${Math.round(hpFrac * 100)}%`;
    }

    if (scanEl.style.display !== "none") scanEl.style.display = "none";

  } else {
    /* ── Resolving: compact scan bar ── */
    iconEl.style.display = "none";
    levelEl.textContent = "";
    targetIndEl.style.display = "none";

    // Scan progress
    const need = computeLockTimeSec(t, st);
    const pct = Math.min(1, (slot.acc || 0) / Math.max(0.05, need));
    hpInner.style.width = `${pct * 100}%`;
    hpLabel.textContent = "";
    shieldInner.style.width = "0%";
    shieldLabel.textContent = "";
    structInner.style.width = "0%";
    structLabel.textContent = "";

    if (scanEl.textContent !== "SCAN") scanEl.textContent = "SCAN";
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
