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
} from "../../targeting.js";

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

  const close = document.createElement("div");
  close.className = "lc-close";
  close.textContent = "×";
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    sfxBlip();
    removeSensorLock(id);
  });
  el.appendChild(close);

  const assign = document.createElement("div");
  assign.className = "lc-assign";
  el.appendChild(assign);

  const targetInd = document.createElement("div");
  targetInd.className = "lc-target";
  el.appendChild(targetInd);

  const name = document.createElement("div");
  name.className = "lc-name";
  el.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "lc-meta";
  el.appendChild(meta);

  const bar = document.createElement("div");
  bar.className = "lc-bar";
  const barInner = document.createElement("span");
  bar.appendChild(barInner);
  el.appendChild(bar);

  const scan = document.createElement("div");
  scan.className = "lc-scan";
  el.appendChild(scan);

  el.addEventListener("click", () => {
    sfxBlip();
    if (G.P._assignTargetId === id) {
      G.P._assignTargetId = null;
    } else {
      G.P._assignTargetId = id;
    }
  });

  hudState.lockRail!.appendChild(el);
  return { el, nameEl: name, metaEl: meta, barInner, barEl: bar, scanEl: scan, assignEl: assign, targetIndEl: targetInd };
}

export function updateLockCard(card: any, slot: any, t: any, st: any, now: number, primaryId: string | null | undefined) {
  const { el, nameEl, metaEl, barInner, barEl, scanEl, assignEl, targetIndEl } = card;

  const isAst = isAsteroidTarget(t.id);
  const isPiece = isWreckPieceTarget(t.id);
  const isPrimary = t.id === primaryId;
  const cls = `lock-card${isPrimary ? " primary" : ""}${isAst ? " asteroid" : ""}${isPiece ? " wreck" : ""}`;
  if (el.className !== cls) el.className = cls;

  const assignBorder = G.P._assignTargetId === t.id ? "rgba(80,220,255,0.9)" : "";
  if (el.style.borderColor !== assignBorder) el.style.borderColor = assignBorder;

  const nameText = (t.name || "Unknown").slice(0, 16);
  if (nameEl.textContent !== nameText) nameEl.textContent = nameText;

  // Targeting indicator (EVE-style: red = locked you, yellow = locking you)
  if (!isPiece && t.hasLockOnPlayer) {
    targetIndEl.textContent = "▼";
    targetIndEl.style.color = "#ff4444";
    targetIndEl.style.display = "block";
  } else if (!isPiece && t.targetingPlayer) {
    targetIndEl.textContent = "▽";
    targetIndEl.style.color = "#ffcc44";
    targetIndEl.style.display = "block";
  } else {
    targetIndEl.style.display = "none";
  }

  const d = Math.round(dst(G.P.x, G.P.y, t.x, t.y));
  let metaText = "";
  if (isAst) {
    const hpFrac = Math.max(0, t.hp / Math.max(1, t.maxHp));
    metaText = `AST  ${d} m  HP ${Math.round(hpFrac * 100)}%`;
  } else if (isPiece) {
    const hpFrac = Math.max(0, t.hp / Math.max(1, t.maxHp));
    metaText = `DEBRIS  ${d} m  HP ${Math.round(hpFrac * 100)}%`;
  } else {
    const relV = Math.round(Math.hypot(G.P.vx - (t.vx || 0), G.P.vy - (t.vy || 0)));
    const trs = Math.round(transversalVs(t));
    const sig = Math.round(t.sigRadius || 30);
    const clsLbl = enemyClassLabel(t.type);
    const band = d < st.wProf.range ? "OPT" : "OFF";
    metaText = `${clsLbl}  ${d} m  ${band}   SIG ${sig}   ΔV ${relV}   TRS ${trs}`;
  }
  if (metaEl.textContent !== metaText) metaEl.textContent = metaText;

  // Assigned slot badges: turrets for enemies/asteroids, salvager slots for pieces
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

  // Bar (dirty-check)
  if (slot.resolving) {
    const need = computeLockTimeSec(t, st);
    const pct = Math.min(1, (slot.acc || 0) / Math.max(0.05, need));
    const barCls = "lc-bar lock";
    const barW = `${pct * 100}%`;
    if (barEl.className !== barCls) barEl.className = barCls;
    if (barInner.style.width !== barW) barInner.style.width = barW;
    if (scanEl.textContent !== "SCAN") scanEl.textContent = "SCAN";
    if (scanEl.style.display !== "block") scanEl.style.display = "block";
  } else if (isPiece) {
    const hpFrac = Math.max(0, t.hp / Math.max(1, t.maxHp));
    const barCls = "lc-bar hp";
    const barW = `${hpFrac * 100}%`;
    if (barEl.className !== barCls) barEl.className = barCls;
    if (barInner.style.width !== barW) barInner.style.width = barW;
    if (scanEl.style.display !== "none") scanEl.style.display = "none";
  } else {
    const hpFrac = Math.max(0, t.hp / Math.max(1, t.maxHp));
    const barCls = "lc-bar hp";
    const barW = `${hpFrac * 100}%`;
    if (barEl.className !== barCls) barEl.className = barCls;
    if (barInner.style.width !== barW) barInner.style.width = barW;
    if (scanEl.style.display !== "none") scanEl.style.display = "none";
  }
}
