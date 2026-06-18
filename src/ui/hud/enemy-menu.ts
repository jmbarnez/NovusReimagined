import "../styles/hud-enemy-menu.css";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { queueFrameAction } from "../../sim/input.js";
import { hudState } from "./state.js";
import { hasCommsEquipment } from "../../player/player-stats.js";
import { randomHailLine } from "../../data/faction-comms.js";
import { t } from "../../utils/i18n.js";
import { setNpcSpeech } from "../../render/npc-speech.js";
import { setHtml, setStyle, setPosition, onClick } from "../dom-helpers.js";

let activeEnemyId: string | null = null;

export function showEnemyCtxMenu(x: number, y: number, enemyId: string) {
  if (!hudState.enemyCtxMenu) return;
  activeEnemyId = enemyId;

  const sys = getState().GALAXY[getState().player.sysIdx];
  const enemy = sys?.enemies?.find((x) => x.id === enemyId);
  const isNeutral = enemy?.faction === "neutral";
  const isLocked = getState().player.lockQueue?.some((slot) => slot.id === enemyId && !slot.resolving) ?? false;

  let hailHtml = "";
  if (isNeutral && enemy?.hailable && hasCommsEquipment()) {
    hailHtml = `<div class="ctx-item" data-action="hail">${t("enemyMenu.hail")}</div><div class="ctx-sep"></div>`;
  }

  setHtml(hudState.enemyCtxMenu, `
    ${hailHtml}
    <div class="ctx-item" data-action="toggle-lock">${isLocked ? t("enemyMenu.unlockTarget") : t("enemyMenu.lockTarget")}</div>
  `);

  setStyle(hudState.enemyCtxMenu, { display: "block" });
  setPosition(hudState.enemyCtxMenu, `${x}px`, `${y}px`);

  // Clamp to viewport
  const rect = hudState.enemyCtxMenu.getBoundingClientRect();
  let adjustedX = x;
  let adjustedY = y;
  let isEdgeRight = false;

  if (x + rect.width > window.innerWidth) {
    adjustedX = x - rect.width;
    isEdgeRight = true;
  }
  if (y + rect.height > window.innerHeight) {
    adjustedY = y - rect.height;
  }

  setPosition(hudState.enemyCtxMenu, `${adjustedX}px`, `${adjustedY}px`);

  if (isEdgeRight) {
    hudState.enemyCtxMenu.classList.add("edge-right");
  } else {
    hudState.enemyCtxMenu.classList.remove("edge-right");
  }

  for (const item of hudState.enemyCtxMenu.querySelectorAll(".ctx-item")) {
    onClick(item, onEnemyCtxItemClick);
  }
}

export function hideEnemyCtxMenu() {
  if (hudState.enemyCtxMenu) {
    setStyle(hudState.enemyCtxMenu, { display: "none" });
  }
}

export function onEnemyCtxItemClick(e: Event) {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;
  if (!action || !activeEnemyId) return;

  e.stopPropagation();
  hideEnemyCtxMenu();

  if (action === "toggle-lock") {
    const isLocked = getState().player.lockQueue?.some((slot) => slot.id === activeEnemyId && !slot.resolving) ?? false;
    if (isLocked) {
      queueFrameAction({ type: "removeSensorLock", payload: { id: activeEnemyId } });
    } else {
      queueFrameAction({ type: "requestSensorLock", payload: { id: activeEnemyId } });
    }
  } else if (action === "hail") {
    if (activeEnemyId) {
      setNpcSpeech(activeEnemyId, randomHailLine(), 4000);
    }
  }
}
