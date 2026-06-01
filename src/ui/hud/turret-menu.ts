import "../styles/hud-turret-menu.css";

import { getState } from "../../state-access.js";
import { queueFrameAction } from "../../sim/input.js";
import { hudState } from "./state.js";
import { playerHardpointRack } from "../../utils/hardpoints.js";

/* ── Turret Context Menu ── */
export function onTurretContextMenu(e: MouseEvent, rack: string, idx: number) {
  e.preventDefault();
  e.stopPropagation();
  const modId = getState().player.fitting[rack]?.[idx];
  if (!modId) return;
  showTurretCtxMenu(e.clientX, e.clientY, idx);
}

export function showTurretCtxMenu(x: number, y: number, turretIdx: number) {
  if (!hudState.turretCtxMenu) return;
  const powered = getState().player.turretPower?.[turretIdx] ?? false;
  const cycling = (getState().player.turretPowerCd?.[turretIdx] || 0) > 0;
  const action = powered ? "Power Down" : "Power Up";
  const btnClass = cycling ? "disabled" : "";

  hudState.turretCtxMenu.innerHTML = `
    <div class="ctx-item ${btnClass}" data-action="toggle-power" data-idx="${turretIdx}">
      ${action} ${cycling ? "(cycling...)" : ""}
    </div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-action="clear-target" data-idx="${turretIdx}">Clear Target</div>
  `;
  hudState.turretCtxMenu.style.display = "block";
  hudState.turretCtxMenu.style.left = `${x}px`;
  hudState.turretCtxMenu.style.top = `${y}px`;

  // Clamp to viewport
  const rect = hudState.turretCtxMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) hudState.turretCtxMenu.style.left = `${x - rect.width}px`;
  if (rect.bottom > window.innerHeight) hudState.turretCtxMenu.style.top = `${y - rect.height}px`;

  hudState.turretCtxMenu.querySelectorAll(".ctx-item").forEach((item) => {
    item.addEventListener("click", onCtxItemClick);
  });
}

export function hideTurretCtxMenu() {
  if (hudState.turretCtxMenu) hudState.turretCtxMenu.style.display = "none";
}

export function onCtxItemClick(e: Event) {
  const action = (e.target as HTMLElement).dataset.action;
  const idx = parseInt((e.target as HTMLElement).dataset.idx!, 10);
  hideTurretCtxMenu();

  if (action === "toggle-power") {
    const cycling = (getState().player.turretPowerCd?.[idx] || 0) > 0;
    if (cycling) return;
    queueFrameAction({
      type: "toggleSlotDefaultAction",
      payload: { rack: playerHardpointRack(getState().player), idx },
    });
  } else if (action === "clear-target") {
    queueFrameAction({
      type: "assignModuleSlotToTarget",
      payload: { slotIdx: idx, targetId: null },
    });
  }
}
