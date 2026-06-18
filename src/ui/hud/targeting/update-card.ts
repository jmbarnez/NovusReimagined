import { getState } from "../../../state-access.js";
import { dst } from "../../../utils/math.js";
import { t as _t } from "../../../utils/i18n.js";
import { setText, setHtml, setStyle, getStyleProperty } from "../../dom-helpers.js";
import {
  isAsteroidTarget,
  isWreckPieceTarget,
  computeLockTimeSec,
  enemyClassLabel,
  computeEnemyLevel,
} from "../../../targeting.js";
import { isGateLockId } from "../../../utils/warp-gates.js";
import type { Enemy } from "../../../types/enemy.js";
import type { Asteroid } from "../../../types/asteroid.js";
import type { WreckPiece } from "../../../types/system.js";
import type { LockSlot, AutoTarget } from "../../../types/combat.js";
import type { ComputedStats } from "../../../player/player-stats.js";
import { drawLiveTargetIcon } from "./icon.js";
import { getAssignTargetId } from "../../../player/target-selection.js";
import type { LockCard } from "./types.js";
import { getAiState } from "../../../physics/npcs/ai-state.js";

export function updateLockCard(
  card: LockCard,
  slot: LockSlot,
  t: Enemy | Asteroid | WreckPiece | AutoTarget,
  st: ComputedStats,
  now: number,
  primaryId: string | null | undefined,
) {
  const {
    el, canvasEl, nameEl, levelEl, targetIndEl,
    shieldInner, shieldLabel, hpInner, hpLabel, structInner, structLabel,
    distMetric, metaEl, scanEl, assignEl,
  } = card;

  const isAst = isAsteroidTarget(t.id);
  const isPiece = isWreckPieceTarget(t.id);
  const isGate = isGateLockId(t.id);
  const isPrimary = t.id === primaryId;
  const isResolved = !slot.resolving;
  const isEnemy = !isAst && !isPiece && !isGate;

  const enemy = isEnemy ? (t as Enemy) : null;
  const isAssigned = getAssignTargetId(getState().player.netId ?? getState().player.shipId) === t.id;

  // CSS classes
  const ai = enemy ? getAiState(enemy.id) : null;
  const targetLockClass = ai && ai.hasLockOnPlayer ? " target-locked" : ai && ai.targetingPlayer ? " target-targeting" : "";
  const enemyClass = isEnemy ? ` enemy${targetLockClass}` : "";
  const resolvedClass = `lock-card${isPrimary ? " primary" : ""}${isAssigned ? " assigned" : ""}${isAst ? " asteroid" : ""}${isPiece ? " wreck" : ""}${isGate ? " gate" : ""}${isResolved ? " resolved" : ""}${enemyClass}`;
  if (el.className !== resolvedClass) el.className = resolvedClass;

  // Name
  const nameText = t.name || _t("hud.unknown");
  if (nameEl.textContent !== nameText) setText(nameEl, nameText);

  // Live icon
  setStyle(canvasEl, { display: isResolved ? "" : "none" });
  if (isResolved) drawLiveTargetIcon(canvasEl, t, isAst, isPiece, isGate);

  if (isResolved) {
    // ── Resolved ──

    // Level
    if (isEnemy && enemy) {
      if (!enemy.level) enemy.level = computeEnemyLevel(enemy);
      const lvlText = String(enemy.level);
      if (levelEl.textContent !== lvlText) setText(levelEl, lvlText);

      // Targeting indicator
      if (ai && ai.hasLockOnPlayer) {
        setText(targetIndEl, "\u25BC");
        setStyle(targetIndEl, { color: "var(--hud-danger)", display: "block" });
      } else if (ai && ai.targetingPlayer) {
        setText(targetIndEl, "\u25BD");
        setStyle(targetIndEl, { color: "var(--hud-accent)", display: "block" });
      } else {
        setStyle(targetIndEl, { display: "none" });
      }
    } else {
      setText(levelEl, "");
      setStyle(targetIndEl, { display: "none" });
    }

    // Distance
    const d = Math.round(dst(getState().player.x, getState().player.y, t.x, t.y));
    const band = d < st.wProf.range ? "opt" : "";
    let distHtml = "";
    if (d < 2000) {
      distHtml = `<span class="d-val">${Math.round(d)}</span><span class="d-unit">m</span>${band ? `<span class="d-band opt">OPT</span>` : ""}`;
    } else {
      const km = d / 1000;
      const kmStr = (Math.round(km * 10) % 10 === 0) ? Math.round(km).toString() : km.toFixed(1);
      distHtml = `<span class="d-val">${kmStr}</span><span class="d-unit">km</span>${band ? `<span class="d-band opt">OPT</span>` : ""}`;
    }
    if (distMetric.innerHTML !== distHtml) setHtml(distMetric, distHtml);

    // Class label
    const metaText = isAst ? _t("hud.asteroid") : isPiece ? _t("hud.debris") : enemy ? enemyClassLabel(enemy.type) : _t("hud.unknown");
    if (metaEl.textContent !== metaText) setText(metaEl, metaText);

    // Bars with structured labels
    const maxSh = enemy?.maxShield || 0;
    const curSh = enemy?.shield || 0;
    const shPct = maxSh > 0 ? curSh / maxSh : 0;
    setStyle(shieldInner, { width: `${shPct * 100}%` });
    setHtml(shieldLabel, maxSh > 0
      ? `<span class="bl-name">SH</span><span class="bl-val">${Math.round(shPct * 100)}%</span>`
      : `<span class="bl-name">SH</span><span class="bl-val">--</span>`);

    const maxHp = "maxHp" in t && typeof t.maxHp === "number" ? t.maxHp : Math.max(1, t.hp);
    const hpFrac = Math.max(0, Math.min(1, t.hp / Math.max(1, maxHp)));
    setStyle(hpInner, { width: `${hpFrac * 100}%` });
    setHtml(hpLabel, `<span class="bl-name">HU</span><span class="bl-val">${Math.round(hpFrac * 100)}%</span>`);

    const maxSt = enemy?.maxStructure || 0;
    const curSt = enemy?.structure || 0;
    const stPct = maxSt > 0 ? curSt / maxSt : 0;
    setStyle(structInner, { width: `${stPct * 100}%` });
    setHtml(structLabel, maxSt > 0
      ? `<span class="bl-name">ST</span><span class="bl-val">${Math.round(stPct * 100)}%</span>`
      : `<span class="bl-name">ST</span><span class="bl-val">--</span>`);

    if (getStyleProperty(scanEl, "display") !== "none") setStyle(scanEl, { display: "none" });

  } else {
    // ── Resolving ──
    setText(levelEl, "");
    setStyle(targetIndEl, { display: "none" });

    // Scan progress fills the HP bar
    const need = computeLockTimeSec(t, st);
    const pct = Math.min(1, (slot.acc || 0) / Math.max(0.05, need));
    setStyle(hpInner, { width: `${pct * 100}%` });
    setHtml(hpLabel, `<span class="bl-name">ACQ</span><span class="bl-val">${Math.round(pct * 100)}%</span>`);

    setStyle(shieldInner, { width: "0%" });
    setHtml(shieldLabel, `<span class="bl-name">SH</span><span class="bl-val">--</span>`);
    setStyle(structInner, { width: "0%" });
    setHtml(structLabel, `<span class="bl-name">ST</span><span class="bl-val">--</span>`);

    // Hide distance/class while resolving
    if (distMetric.innerHTML !== "") setHtml(distMetric, "");
    if (metaEl.textContent !== "") setText(metaEl, "");

    if (getStyleProperty(scanEl, "display") !== "none") setStyle(scanEl, { display: "none" });
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
