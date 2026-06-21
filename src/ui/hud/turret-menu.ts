import "../styles/hud-turret-menu.css";

import { getState } from "../../state-access.js";
import { queueFrameAction } from "../../sim/input.js";
import { hudState } from "./state.js";
import { playerHardpointRack } from "../../utils/hardpoints.js";
import { setHtml, setStyle, setPosition, getStyleProperty, onClick } from "../dom-helpers.js";

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

  setHtml(hudState.turretCtxMenu, `
    <div class="ctx-item" data-action="clear-target" data-idx="${turretIdx}">Clear Target</div>
  `);
  setStyle(hudState.turretCtxMenu, { display: "block" });
  setPosition(hudState.turretCtxMenu, `${x}px`, `${y}px`);

  // Clamp to viewport
  const rect = hudState.turretCtxMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) setPosition(hudState.turretCtxMenu, `${x - rect.width}px`, getStyleProperty(hudState.turretCtxMenu, "top"));
  if (rect.bottom > window.innerHeight) setPosition(hudState.turretCtxMenu, getStyleProperty(hudState.turretCtxMenu, "left"), `${y - rect.height}px`);

  for (const item of hudState.turretCtxMenu.querySelectorAll(".ctx-item")) {
    onClick(item, onCtxItemClick);
  }
}

export function hideTurretCtxMenu() {
  if (hudState.turretCtxMenu) setStyle(hudState.turretCtxMenu, { display: "none" });
}

export function onCtxItemClick(e: Event) {
  const action = (e.target as HTMLElement).dataset.action;
  const idx = parseInt((e.target as HTMLElement).dataset.idx!, 10);
  hideTurretCtxMenu();

  if (action === "clear-target") {
    queueFrameAction({
      type: "assignModuleSlotToTarget",
      payload: { slotIdx: idx, targetId: null },
    });
  }
}
