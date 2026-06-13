import { getState } from "../../../state-access.js";
import { dst } from "../../../utils/math.js";
import { t as _t } from "../../../utils/i18n.js";
import { setText, setHtml, setStyle, getStyleProperty } from "../../dom-helpers.js";
import {
  isAsteroidTarget,
  isWreckPieceTarget,
  computeLockTimeSec,
  enemyClassLabel,
  transversalVs,
  computeEnemyLevel,
} from "../../../targeting.js";
import { isGateLockId } from "../../../utils/warp-gates.js";
import type { Enemy, Asteroid, WreckPiece, LockSlot, AutoTarget } from "../../../types/world.js";
import type { ComputedStats } from "../../../player/player-stats.js";
import { drawLiveTargetIcon } from "./icon.js";
import type { LockCard } from "./types.js";

function targetSignalRadius(t: Enemy | Asteroid | WreckPiece | AutoTarget, enemy: Enemy | null): number {
  if (enemy) return enemy.sigRadius || 30;
  if ("sigRadius" in t && typeof t.sigRadius === "number") return t.sigRadius;
  if ("radius" in t && typeof t.radius === "number") return t.radius;
  return 30;
}

export function updateLockCard(
  card: LockCard,
  slot: LockSlot,
  t: Enemy | Asteroid | WreckPiece | AutoTarget,
  st: ComputedStats,
  now: number,
  primaryId: string | null | undefined,
) {
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
  const nameText = (t.name || _t("hud.unknown")).slice(0, 16);
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

    const spdHtml = `<span class="m-val">${speed}</span> ${_t("hud.mps")}`;

    let distHtml = "";
    if (d < 2000) {
      distHtml = `<span class="m-val">${Math.round(d)}</span> m ${band}`;
    } else {
      const km = d / 1000;
      const kmStr = (Math.round(km * 10) % 10 === 0) ? Math.round(km).toString() : km.toFixed(1);
      distHtml = `<span class="m-val">${kmStr}</span> ${_t("hud.km")} ${band === "OPT" ? _t("hud.opt") : _t("hud.off")}`;
    }

    const sigHtml = `${_t("hud.sig")} <span class="m-val">${sig}</span>`;
    const trsHtml = `${_t("hud.trs")} <span class="m-val">${trs}</span>`;

    if (spdMetric.innerHTML !== spdHtml) setHtml(spdMetric, spdHtml);
    if (distMetric.innerHTML !== distHtml) setHtml(distMetric, distHtml);
    if (sigMetric.innerHTML !== sigHtml) setHtml(sigMetric, sigHtml);
    if (trsMetric.innerHTML !== trsHtml) setHtml(trsMetric, trsHtml);

    // Meta label text
    const metaText = isAst ? _t("hud.asteroid") : isPiece ? _t("hud.debris") : enemy ? enemyClassLabel(enemy.type) : _t("hud.unknown");
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

    const scanText = _t("hud.scanning");
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
