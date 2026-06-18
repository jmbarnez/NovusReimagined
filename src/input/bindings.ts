import { Client } from "../state.js";
import { closeStationUi, getDockableStation, openStationUi } from "../docking/index.js";
import { getState } from "../state-access.js";
import { closeMapWindow, toggleMapWindow } from "../ui/hud-overlay/map-overlay.js";
import { curSys } from "../utils/game.js";
import { toggleSettings, closeSettings, listeningFor } from "../ui/settings/index.js";
import { togglePauseMenu, closePauseMenu } from "../ui/pause-menu.js";
import { toggleCargoWindow, toggleScannerDock, toggleSkillsWindow, toggleHubWindow, toggleEventLogPanel } from "../ui/hud-overlay.js";
import { closeTopmostWindow } from "../ui/hud/windows.js";
import { applyBarHotkey } from "../player/player-fitting.js";
import { queueFrameAction } from "../sim/input.js";
import { isEventLogToggleHotkey, isOverviewToggleHotkey } from "../input-hotkeys.js";
import { dst } from "../utils/math.js";
import { gateStableId } from "../utils/warp-gates.js";
import type { Enemy } from "../types/enemy.js";
import { forEachAiState } from "../physics/npcs/ai-state.js";
import { setCursorLock, getCanvasElement, isBlockedByUi, getUiPointerBlockSelector } from "./core.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import { isCurrentStepComplete } from "../tutorial/index.js";

function isTutorialUndockBlocked(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "industry" && step.id !== "hangar-turrets")) return false;
  return !isCurrentStepComplete();
}

export function handleKeyDown(e: KeyboardEvent): void {
  const k = e.key.toLowerCase();
  const { keybinds } = Client.settings;
  const canvasEl = getCanvasElement();
  const uiBlockSelector = getUiPointerBlockSelector();

  if (e.code === keybinds.perf) {
    Client.showPerf = !Client.showPerf;
    return;
  }

  if (!Client.gameStarted) return;

  if (Client.settingsOpen && listeningFor) return;

  Client.keys[k] = true;

  // Brake — only space cancels the waypoint.
  if (e.code === keybinds.brake) Client.keys[" "] = true;
  if (e.code === keybinds.engineBoost || e.code === "ShiftLeft" || e.code === "ShiftRight") Client.keys["boost"] = true;
  if (e.code === keybinds.forwardThrust) Client.keys["w"] = true;
  if (e.code === keybinds.reverseThrust) Client.keys["s"] = true;
  if (e.code === keybinds.turnLeft) Client.keys["a"] = true;
  if (e.code === keybinds.turnRight) Client.keys["d"] = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(false, canvasEl);

  if (e.code === keybinds.settings) {
    if (Client.settingsOpen) { closeSettings(); return; }
    const pauseOverlay = document.getElementById("pause-overlay");
    if (pauseOverlay && pauseOverlay.style.display === "flex") { closePauseMenu(); return; }
    if (Client.showMap) { closeMapWindow(); return; }
    if (Client.stationOpen) {
      if (isTutorialUndockBlocked()) return;
      queueFrameAction({ type: "undock" });
      closeStationUi();
      return;
    }
    // Close topmost hud window first, then fall through to pause menu
    if (closeTopmostWindow()) return;
    togglePauseMenu();
    return;
  }

  if (Client.settingsOpen) return;

  // Inventory / Cargo
  if (e.code === keybinds.inventory) {
    if (Client.stationOpen || Client.settingsOpen) return;
    toggleCargoWindow();
    return;
  }

  // Scanner / Overview (toggle dock)
  if (isOverviewToggleHotkey(e.code, keybinds)) {
    if (Client.stationOpen || Client.settingsOpen) return;
    toggleScannerDock();
    return;
  }

  // Comms Log
  if (isEventLogToggleHotkey(e.code, keybinds, e)) {
    if (Client.stationOpen || Client.settingsOpen) return;
    toggleEventLogPanel();
    return;
  }

  // Skills window
  if (e.code === keybinds.skills) {
    if (Client.stationOpen || Client.settingsOpen) return;
    toggleSkillsWindow();
    return;
  }

  if (e.code === keybinds.dock) {
    if (Client.stationOpen) {
      if (isTutorialUndockBlocked()) return;
      queueFrameAction({ type: "undock" });
      closeStationUi();
    } else {
      const sys = curSys();
      let anyLocked = false;
      forEachAiState((_id, s) => { if (s.hasLockOnPlayer) anyLocked = true; });
      if (sys && anyLocked) return;
      if (sys) {
        // Processing hub intercept — opens window instead of docking
        let handledByHub = false;
        for (const st of sys.stations) {
          if (!st.isProcessingHub) continue;
          const interactR = (st.collectRadius ?? 220) + 80;
          if (dst(getState().player.x, getState().player.y, st.x, st.y) < interactR) {
            toggleHubWindow();
            handledByHub = true;
            break;
          }
        }
        if (!handledByHub) {
          const station = getDockableStation(getState().player);
          if (station) {
            queueFrameAction({ type: "dock", payload: { stationId: station.id } });
            void openStationUi(station);
          }
        }
      }
    }
  }

  if (e.code === keybinds.warp) {
    if (Client.stationOpen || Client.settingsOpen) return;
    Client.keys["warp"] = true;
  }

  if (e.code === keybinds.map) {
    toggleMapWindow();
  }
  const rackKeys = ["1","2","3","4","5","6","7","8","9","0"];
  const idx = rackKeys.indexOf(k);
  if (idx !== -1) {
    applyBarHotkey(idx);
  }
}

export function handleKeyUp(e: KeyboardEvent): void {
  if (!Client.gameStarted) return;
  const k = e.key.toLowerCase();
  const { keybinds } = Client.settings;
  const canvasEl = getCanvasElement();

  Client.keys[k] = false;
  if (e.code === keybinds.brake) Client.keys[" "] = false;
  if (e.code === keybinds.engineBoost || e.code === "ShiftLeft" || e.code === "ShiftRight") Client.keys["boost"] = false;
  if (e.code === keybinds.forwardThrust) Client.keys["w"] = false;
  if (e.code === keybinds.reverseThrust) Client.keys["s"] = false;
  if (e.code === keybinds.turnLeft) Client.keys["a"] = false;
  if (e.code === keybinds.turnRight) Client.keys["d"] = false;
  if (e.code === keybinds.warp) Client.keys["warp"] = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(true, canvasEl);
}
