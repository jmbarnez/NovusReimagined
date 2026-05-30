import "../styles/hud-enemy-menu.css";
import { Client } from "../../state.js";
import { setNavCommand, clearNav, getState } from "../../state-access.js";
import { requestSensorLock, removeSensorLock } from "../../targeting.js";
import { hudState } from "./state.js";
import { formatDistance } from "../../utils/format.js";
import { hasCommsEquipment } from "../../player/player-stats.js";
import { randomHailLine } from "../../data/faction-comms.js";

let activeEnemyId: string | null = null;

export function showEnemyCtxMenu(x: number, y: number, enemyId: string) {
  if (!hudState.enemyCtxMenu) return;
  activeEnemyId = enemyId;

  const sys = getState().GALAXY[getState().player.sysIdx];
  const enemy = sys?.enemies?.find((x) => x.id === enemyId);
  const isNeutral = enemy?.faction === "neutral";
  const isLocked = getState().player.lockQueue?.some((slot) => slot.id === enemyId && !slot.resolving) ?? false;
  const hasNav = Client.navCommand !== null;

  const presets = [150, 300, 500, 1000, 1500, 2000, 3000, 5000];
  const orbitSubmenu = presets
    .map(p => `<div class="ctx-item" data-action="orbit" data-range="${p}">${formatDistance(p)}</div>`)
    .join("");
  const keepRangeSubmenu = presets
    .map(p => `<div class="ctx-item" data-action="keepRange" data-range="${p}">${formatDistance(p)}</div>`)
    .join("");

  let hailHtml = "";
  if (isNeutral && enemy?.hailable && hasCommsEquipment()) {
    hailHtml = `<div class="ctx-item" data-action="hail">Hail Ship</div><div class="ctx-sep"></div>`;
  }

  hudState.enemyCtxMenu.innerHTML = `
    ${hailHtml}
    <div class="ctx-item ctx-has-submenu">
      Orbit <span class="ctx-arrow">▸</span>
      <div class="ctx-submenu">
        ${orbitSubmenu}
      </div>
    </div>
    <div class="ctx-item ctx-has-submenu">
      Keep at Range <span class="ctx-arrow">▸</span>
      <div class="ctx-submenu">
        ${keepRangeSubmenu}
      </div>
    </div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-action="toggle-lock">${isLocked ? "Unlock Target" : "Lock Target"}</div>
    <div class="ctx-item ${hasNav ? '' : 'disabled'}" data-action="stop">Stop</div>
  `;

  hudState.enemyCtxMenu.style.display = "block";
  hudState.enemyCtxMenu.style.left = `${x}px`;
  hudState.enemyCtxMenu.style.top = `${y}px`;

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

  hudState.enemyCtxMenu.style.left = `${adjustedX}px`;
  hudState.enemyCtxMenu.style.top = `${adjustedY}px`;

  if (isEdgeRight) {
    hudState.enemyCtxMenu.classList.add("edge-right");
  } else {
    hudState.enemyCtxMenu.classList.remove("edge-right");
  }

  hudState.enemyCtxMenu.querySelectorAll(".ctx-item").forEach((item) => {
    item.addEventListener("click", onEnemyCtxItemClick);
  });
}

export function hideEnemyCtxMenu() {
  if (hudState.enemyCtxMenu) {
    hudState.enemyCtxMenu.style.display = "none";
  }
}

export function onEnemyCtxItemClick(e: Event) {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;
  if (!action || !activeEnemyId) return;

  e.stopPropagation();
  hideEnemyCtxMenu();

  if (action === "orbit") {
    const rangePx = parseFloat(target.dataset.range!);
    const dir = Math.random() < 0.5 ? 1 : -1;
    setNavCommand({ mode: "orbit", targetId: activeEnemyId, rangePx, dir });
  } else if (action === "keepRange") {
    const rangePx = parseFloat(target.dataset.range!);
    setNavCommand({ mode: "keepRange", targetId: activeEnemyId, rangePx, dir: 1 });
  } else if (action === "toggle-lock") {
    const isLocked = getState().player.lockQueue?.some((slot) => slot.id === activeEnemyId && !slot.resolving) ?? false;
    if (isLocked) {
      removeSensorLock(activeEnemyId);
    } else {
      requestSensorLock(activeEnemyId);
    }
  } else if (action === "hail") {
    const sys = getState().GALAXY[getState().player.sysIdx];
    const enemy = sys?.enemies?.find((x) => x.id === activeEnemyId);
    if (enemy) {
      enemy._speech = {
        text: randomHailLine(),
        until: performance.now() + 4000,
      };
    }
  } else if (action === "stop") {
    clearNav();
  }
}
