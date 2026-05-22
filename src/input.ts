import { G, Client } from "./state.js";
import type { Enemy, Station } from "./types/world.js";
import { PlayerAccess, clearNav } from "./state-access.js";
import { showEnemyCtxMenu } from "./ui/hud/enemy-menu.js";
import { undockStation, tryWarp } from "./dock.js";
import { dst } from "./utils/math.js";

import { curSys } from "./utils/game.js";
import { requestSensorLock } from "./targeting.js";
import { toggleSettings, closeSettings, listeningFor } from "./ui/settings.js";
import { toggleCargoWindow, toggleScannerDock, toggleSkillsWindow, toggleHubWindow } from "./ui/hud-overlay.js";
import { closeTopmostWindow } from "./ui/hud/windows.js";
import { applyBarHotkey, barHotkeySlotList, toggleSlotDefaultAction } from "./player/player-fitting.js";
import { playBackgroundMusic } from "./audio/music.js";
import { resumeAudio, sfxTurretAssign } from "./audio/procedural.js";

export function initInput() {
  const canvasEl = document.getElementById("c") as HTMLCanvasElement;

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
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(false);

    if (Client.keys[" "]) Client.waypoint = null;

    if (e.code === keybinds.settings) {
      if (Client.settingsOpen) { closeSettings(); return; }
      if (Client.showMap) { Client.showMap = false; return; }
      if (Client.stationOpen) { undockStation(); return; }
      // Close topmost hud window first, then fall through to settings
      if (closeTopmostWindow()) return;
      toggleSettings();
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
    if (e.code === keybinds.overview) {
      if (Client.stationOpen || Client.settingsOpen) return;
      toggleScannerDock();
      return;
    }

    // Skills window
    if (e.code === keybinds.skills) {
      if (Client.stationOpen || Client.settingsOpen) return;
      toggleSkillsWindow();
      return;
    }

    if (e.code === keybinds.dock) {
      if (Client.stationOpen) undockStation();
      else if (!tryWarp()) {
        const sys = curSys();
        if (sys && sys._liveEnemies?.some((e: Enemy) => e.hasLockOnPlayer)) return;
        if (sys) {
          // Processing hub intercept — opens window instead of docking
          let handledByHub = false;
          for (const st of sys.stations) {
            if (!st.isProcessingHub) continue;
            const interactR = (st.collectRadius ?? 220) + 80;
            if (dst(G.P.x, G.P.y, st.x, st.y) < interactR) {
              toggleHubWindow();
              handledByHub = true;
              break;
            }
          }
          if (!handledByHub) {
            for (const st of sys.stations) {
              if (st.isProcessingHub) continue;
              if (dst(G.P.x, G.P.y, st.x, st.y) < st.radius * 2) {
                import("./dock.js").then((m) => m.dockAt(st));
                break;
              }
            }
          }
        }
      }
    }
    if (e.code === keybinds.map) {
      if (!Client.showMap) {
        // Open in system view first
        Client.showMap = true;
        Client.showSystemMap = true;
      } else if (Client.showSystemMap) {
        // Switch to galaxy view
        Client.showSystemMap = false;
      } else {
        // Close
        Client.showMap = false;
      }
    }
    const rackKeys = ["1","2","3","4","5","6","7","8","9","0"];
    const idx = rackKeys.indexOf(k);
    if (idx !== -1) {
      const slots = barHotkeySlotList();
      if (idx < slots.length && slots[idx].rack === "turret") {
        const tIdx = slots[idx].idx;
        if (!(G.P.turretPower?.[tIdx] ?? false)) {
          toggleSlotDefaultAction("turret", tIdx);
        }
        PlayerAccess.setFireControlSlot(tIdx);
        if (G.P._assignTargetId) {
          PlayerAccess.setTurretTarget(tIdx, G.P._assignTargetId);
          PlayerAccess.setAssignTargetId(null);
          sfxTurretAssign();
        }
      } else {
        applyBarHotkey(idx);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!Client.gameStarted) return;
    const k = e.key.toLowerCase();
    Client.keys[k] = false;
    if (e.code === Client.settings.keybinds.brake) Client.keys[" "] = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setCursorLock(true);
  });

  window.addEventListener("blur", () => {
    Client.keys[" "] = false;
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
      Client.mouse.lmb = true;

      if (e.target instanceof Element && e.target.closest("#hud-overlay > *, #title-screen, .eve-window")) return;

      if (!Client.stationOpen && !Client.bridgeOpen) {
        const wx = Client.mouseWorld.x, wy = Client.mouseWorld.y;
        const sys = curSys();
        let locked = false;
        if (sys) {
          for (const en of sys.enemies) {
            if (en.alive && dst(wx, wy, en.x, en.y) < 30) {
              requestSensorLock(en.id);
              locked = true;
              break;
            }
          }
          if (!locked) {
            for (const a of sys.asteroids) {
              if (!a.depleted && a.hp > 0 && dst(wx, wy, a.x, a.y) < a.radius + 12) {
                requestSensorLock(a.id);
                locked = true;
                break;
              }
            }
          }
          if (!locked) {
            for (const p of G.wreckPieces) {
              if (p.hp > 0 && dst(wx, wy, p.x, p.y) < 22) {
                requestSensorLock(p.id);
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
      if (e.target instanceof Element && e.target.closest("#station-overlay, #bridge-overlay, #settings-overlay, #wreck-overlay, #hud-overlay, #title-screen, .eve-window")) return;
      
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
        Client.mouse.rmb = true;
        Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
        clearNav();
      }
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) Client.mouse.rmb = false;
  });

  window.addEventListener("mousemove", (e) => {
    Client.mouse.x = e.clientX;
    Client.mouse.y = e.clientY;
    if (Client.mouse.rmb) {
      Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
    }
  });

  window.addEventListener("wheel", (e) => {
    if (!Client.gameStarted) return;
    if (e.target instanceof Element && e.target.closest("#station-overlay, #bridge-overlay, #settings-overlay, #wreck-overlay, #hud-overlay, .eve-window")) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    Client.zoom = Math.max(0.5, Math.min(2.0, Client.zoom * delta));
  }, { passive: true });

  window.addEventListener("contextmenu", (e) => {
    if (e.target instanceof Element && e.target.closest(".hud-slot[data-rack='turret']")) return;
    e.preventDefault();
  });
}


