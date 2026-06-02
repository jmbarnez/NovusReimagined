import { Client } from "./state.js";
import type { Enemy } from "./types/world.js";
import { clearNav, getState } from "./state-access.js";
import { showEnemyCtxMenu } from "./ui/hud/enemy-menu.js";
import { closeStationUi, getDockableStation, getWarpGateInRange, openStationUi } from "./dock.js";
import { dst } from "./utils/math.js";
import { closeMapWindow, toggleMapWindow } from "./ui/hud-overlay/map-overlay.js";

import { curSys } from "./utils/game.js";
import { toggleSettings, closeSettings, listeningFor } from "./ui/settings/index.js";
import { togglePauseMenu, closePauseMenu } from "./ui/pause-menu.js";
import { toggleCargoWindow, toggleScannerDock, toggleSkillsWindow, toggleHubWindow, toggleEventLogPanel } from "./ui/hud-overlay.js";
import { closeTopmostWindow } from "./ui/hud/windows.js";
import { applyBarHotkey } from "./player/player-fitting.js";
import { queueFrameAction } from "./sim/input.js";
import { playBackgroundMusic } from "./audio/music.js";
import { resumeAudio } from "./audio/procedural.js";
import { isEventLogToggleHotkey, isOverviewToggleHotkey } from "./input-hotkeys.js";
import { app } from "./pixi.js";
import { gateStableId } from "./utils/warp-gates.js";

let inputInitialized = false;

export function initInput() {
  if (inputInitialized) return;
  inputInitialized = true;

  const canvasEl = (app?.canvas as HTMLCanvasElement | undefined) ?? null;
  const uiPointerBlockSelector = [
    "#station-overlay",
    "#bridge-overlay",
    "#settings-overlay",
    "#wreck-overlay",
    "#pause-overlay",
    "#title-screen",
    ".eve-window",
    "#hud-bottom",
    "#hud-minimap",
    "[id^='hud-win-']",
  ].join(", ");

  const isBlockedByUi = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(uiPointerBlockSelector);

  const setCursorLock = (locked: boolean) => {
    Client.cursorUnlocked = !locked;
    if (canvasEl) canvasEl.style.cursor = locked ? "none" : "default";
  };

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    const { keybinds } = Client.settings;

    if (e.code === keybinds.perf) {
      Client.showPerf = !Client.showPerf;
      return;
    }

    if (!Client.gameStarted) return;

    if (Client.settingsOpen && listeningFor) return;

    Client.keys[k] = true;

    // Brake — only space cancels the waypoint.
    if (e.code === keybinds.brake) Client.keys[" "] = true;
    if (Client.settings.movementControlMode === "direct") {
      if (e.code === keybinds.forwardThrust) Client.keys["w"] = true;
      if (e.code === keybinds.reverseThrust) Client.keys["s"] = true;
      if (e.code === keybinds.turnLeft) Client.keys["a"] = true;
      if (e.code === keybinds.turnRight) Client.keys["d"] = true;
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(false);

    if (Client.keys[" "]) Client.waypoint = null;

    if (e.code === keybinds.settings) {
      if (Client.settingsOpen) { closeSettings(); return; }
      const pauseOverlay = document.getElementById("pause-overlay");
      if (pauseOverlay && pauseOverlay.style.display === "flex") { closePauseMenu(); return; }
      if (Client.showMap) { closeMapWindow(); return; }
      if (Client.stationOpen) {
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
        queueFrameAction({ type: "undock" });
        closeStationUi();
      } else {
        const gate = getWarpGateInRange(getState().player);
        if (gate) {
          queueFrameAction(gate.targetSysIdx == null
            ? { type: "warp" }
            : { type: "warp", payload: { targetIdx: gate.targetSysIdx } });
          return;
        }
        const sys = curSys();
        if (sys && sys._liveEnemies?.some((e: Enemy) => e.hasLockOnPlayer)) return;
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
    if (e.code === keybinds.map) {
      toggleMapWindow();
    }
    const rackKeys = ["1","2","3","4","5","6","7","8","9","0"];
    const idx = rackKeys.indexOf(k);
    if (idx !== -1) {
      applyBarHotkey(idx);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!Client.gameStarted) return;
    const k = e.key.toLowerCase();
    Client.keys[k] = false;
    if (e.code === Client.settings.keybinds.brake) Client.keys[" "] = false;
    if (e.code === Client.settings.keybinds.forwardThrust) Client.keys["w"] = false;
    if (e.code === Client.settings.keybinds.reverseThrust) Client.keys["s"] = false;
    if (e.code === Client.settings.keybinds.turnLeft) Client.keys["a"] = false;
    if (e.code === Client.settings.keybinds.turnRight) Client.keys["d"] = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(true);
  });

  window.addEventListener("blur", () => {
    Client.keys[" "] = false;
    Client.keys["w"] = false;
    Client.keys["a"] = false;
    Client.keys["s"] = false;
    Client.keys["d"] = false;
    Client.keys["shift"] = false;
    Client.mouse.lmb = false;
    Client.mouse.rmb = false;
    setCursorLock(true);
  });

  let _audioStarted = false;
  window.addEventListener("mousedown", (e) => {
    if (!_audioStarted) {
      _audioStarted = true;
      resumeAudio();
      playBackgroundMusic();
    }
    if (e.button === 0) {
      const shiftClick = e.shiftKey || !!Client.keys["shift"];
      const directShiftLock = Client.settings.movementControlMode === "direct" && shiftClick;
      Client.mouse.lmb = !directShiftLock;
      if (directShiftLock) setCursorLock(false);

      // Map drag start
      if (Client.showMap && e.target instanceof Element && isBlockedByUi(e.target)) {
        const mapOverlay = e.target.closest("#map-overlay, #hud-win-body-map");
        if (mapOverlay) {
          Client.mapDragging = true;
          Client.mapDragLastSx = e.clientX;
          Client.mapDragLastSy = e.clientY;
          return;
        }
      }

      if (isBlockedByUi(e.target)) return;

      const canClickLock = Client.settings.movementControlMode !== "direct" || shiftClick;
      if (canClickLock && !Client.stationOpen && !Client.bridgeOpen) {
        const wx = Client.mouseWorld.x, wy = Client.mouseWorld.y;
        const sys = curSys();
        let locked = false;
        if (sys) {
          for (const en of sys.enemies) {
            if (en.alive && dst(wx, wy, en.x, en.y) < 30) {
              queueFrameAction({ type: "requestSensorLock", payload: { id: en.id } });
              locked = true;
              break;
            }
          }
          if (!locked) {
            for (const a of sys.asteroids) {
              if (!a.depleted && a.hp > 0 && dst(wx, wy, a.x, a.y) < a.radius + 12) {
                queueFrameAction({ type: "requestSensorLock", payload: { id: a.id } });
                locked = true;
                break;
              }
            }
          }
          if (!locked) {
            for (const p of getState().wreckPieces) {
              if (p.hp > 0 && dst(wx, wy, p.x, p.y) < 22) {
                queueFrameAction({ type: "requestSensorLock", payload: { id: p.id } });
                locked = true;
                break;
              }
            }
          }
          if (!locked) {
            for (const gate of sys.gates) {
              if (dst(wx, wy, gate.x, gate.y) < gate.radius * 1.2) {
                queueFrameAction({ type: "requestSensorLock", payload: { id: gateStableId(gate) } });
                locked = true;
                break;
              }
            }
          }
        }
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      Client.mouse.lmb = false;
    }
  });

  window.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      if (isBlockedByUi(e.target)) return;
      
      let enemyClicked = null;
      if (!Client.stationOpen && !Client.bridgeOpen) {
        const wx = Client.mouseWorld.x, wy = Client.mouseWorld.y;
        const sys = curSys();
        if (sys) {
          for (const en of sys.enemies) {
            if (en.alive && dst(wx, wy, en.x, en.y) < 30) {
              enemyClicked = en;
              break;
            }
          }
        }
      }

      if (enemyClicked) {
        showEnemyCtxMenu(e.clientX, e.clientY, enemyClicked.id);
      } else {
        if (Client.settings.movementControlMode === "waypoint") {
          Client.mouse.rmb = true;
          Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
          clearNav();
        }
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      Client.mouse.lmb = false;
      Client.mapDragging = false;
    }
    if (e.button === 2) Client.mouse.rmb = false;
  });

  window.addEventListener("mousemove", (e) => {
    Client.mouse.x = e.clientX;
    Client.mouse.y = e.clientY;
    
    // Map drag
    if (Client.mapDragging) {
      const dx = e.clientX - Client.mapDragLastSx;
      const dy = e.clientY - Client.mapDragLastSy;
      Client.mapPanX += dx;
      Client.mapPanY += dy;
      Client.mapDragLastSx = e.clientX;
      Client.mapDragLastSy = e.clientY;
    }
    
    if (Client.mouse.rmb && Client.settings.movementControlMode === "waypoint") {
      Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
    }
  });

  window.addEventListener("wheel", (e) => {
    if (!Client.gameStarted) return;
    if (e.target instanceof Element && e.target.closest("#station-overlay, #bridge-overlay, #settings-overlay, #wreck-overlay, #hud-overlay, .eve-window")) {
      if (!(Client.showMap && e.target.closest("#map-overlay"))) return;
    }

    // Map zoom when map is open
    if (Client.showMap) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      Client.mapZoom = Math.max(0.2, Math.min(3.0, Client.mapZoom * delta));
      return;
    }
    
    // World zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    Client.zoom = Math.max(0.5, Math.min(2.0, Client.zoom * delta));
  }, { passive: true });

  window.addEventListener("contextmenu", (e) => {
    if (e.target instanceof Element && e.target.closest(".hud-slot[data-rack='turret']")) return;
    e.preventDefault();
  });
}


