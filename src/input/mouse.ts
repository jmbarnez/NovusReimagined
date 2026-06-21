import { Client } from "../state.js";
import { queueFrameAction } from "../sim/input.js";
import { showEnemyCtxMenu } from "../ui/hud/enemy-menu.js";
import { showZoomIndicator } from "../ui/hud/zoom-indicator.js";
import { curSys } from "../utils/game.js";
import { dst } from "../utils/math.js";
import { gateStableId } from "../utils/warp-gates.js";
import { getState } from "../state-access.js";
import { stopEngineNodes } from "../audio/procedural.js";
import { getCanvasElement, isBlockedByUi, getUiPointerBlockSelector, setCursorLock, clearAllInputState } from "./core.js";

let _audioStarted = false;

export function handleMouseDown(e: MouseEvent): void {
  if (!_audioStarted) {
    _audioStarted = true;
    // Audio resume handled by caller
  }
  if (e.button === 0) {
    const shiftClick = e.shiftKey || !!Client.keys["shift"];
    if (shiftClick) setCursorLock(false, getCanvasElement());

    const blockedByUi = e.target instanceof Element && isBlockedByUi(e.target, getUiPointerBlockSelector());

    // Map drag start
    if (Client.showMap && blockedByUi) {
      const mapOverlay = e.target.closest("#map-overlay, #hud-win-body-map");
      if (mapOverlay) {
        Client.mapDragging = true;
        Client.mapDragLastSx = e.clientX;
        Client.mapDragLastSy = e.clientY;
        return;
      }
    }

    // Don't activate LMB (mining/fire) when clicking on HUD or UI elements
    if (blockedByUi) return;

    Client.mouse.lmb = !shiftClick;

    // Manual fire on LMB click
    if (
      !Client.keys["shift"] &&
      Client.gameStarted &&
      !Client.stationOpen &&
      !Client.bridgeOpen &&
      !Client.showMap &&
      !Client.settingsOpen
    ) {
      queueFrameAction({ type: "fireSelectedTurret" });
    }

    // Target locking on Ctrl+click
    if (e.ctrlKey && !Client.stationOpen && !Client.bridgeOpen) {
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
  if (e.button === 2) {
    if (isBlockedByUi(e.target, getUiPointerBlockSelector())) return;

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
    }
  }
}

export function handleMouseUp(e: MouseEvent): void {
  if (e.button === 0) {
    Client.mouse.lmb = false;
    Client.mapDragging = false;
  }
  if (e.button === 2) Client.mouse.rmb = false;
}

export function handleMouseMove(e: MouseEvent): void {
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

}

export function handleWheel(e: WheelEvent): void {
  if (!Client.gameStarted) return;
  if (e.target instanceof Element && e.target.closest("#station-overlay, #bridge-overlay, #settings-overlay, #wreck-overlay, #hud-overlay, .window")) {
    // Allow wheel over the entire map window when the map is open
    if (Client.showMap && e.target.closest("#hud-win-map")) {
      // fall through to map zoom
    } else if (!(Client.showMap && e.target.closest("#map-overlay"))) {
      return;
    }
  }

  // Map zoom when map is open
  if (Client.showMap) {
    const oldZoom = Client.mapZoom || 1.0;
    const step = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3.0, oldZoom * step));

    // Zoom toward cursor
    const win = document.getElementById("hud-win-map");
    if (win && oldZoom > 0 && Number.isFinite(oldZoom)) {
      const rect = win.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const panX1 = Client.mapPanX + cx * (1 - oldZoom);
      const panY1 = Client.mapPanY + cy * (1 - oldZoom);

      const panX2 = mx - (mx - panX1) * newZoom / oldZoom;
      const panY2 = my - (my - panY1) * newZoom / oldZoom;

      Client.mapPanX = panX2 - cx * (1 - newZoom);
      Client.mapPanY = panY2 - cy * (1 - newZoom);
    }

    Client.mapZoom = newZoom;
    showZoomIndicator(newZoom, e.clientX, e.clientY);
    return;
  }

  // World zoom
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newWorldZoom = Math.max(0.5, Math.min(2.0, Client.zoom * delta));
  Client.zoom = newWorldZoom;
  showZoomIndicator(newWorldZoom, e.clientX, e.clientY);
}

export function handleContextMenu(e: Event): void {
  if (e.target instanceof Element && e.target.closest(".hud-slot[data-rack='turret']")) return;
  e.preventDefault();
}

export function handleWindowBlur(): void {
  clearAllInputState();
  stopEngineNodes();
  const canvas = getCanvasElement();
  if (!canvas) return;
  setCursorLock(true, canvas);
}
