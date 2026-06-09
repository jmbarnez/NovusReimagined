import { Client } from "../state.js";
import { queueFrameAction } from "../sim/input.js";
import { showEnemyCtxMenu } from "../ui/hud/enemy-menu.js";
import { curSys } from "../utils/game.js";
import { dst } from "../utils/math.js";
import { gateStableId } from "../utils/warp-gates.js";
import { clearNav, getState } from "../state-access.js";
import { getCanvasElement, isBlockedByUi, getUiPointerBlockSelector, setCursorLock, clearAllInputState } from "./core.js";

let _audioStarted = false;

export function handleMouseDown(e: MouseEvent): void {
  if (!_audioStarted) {
    _audioStarted = true;
    // Audio resume handled by caller
  }
  if (e.button === 0) {
    const shiftClick = e.shiftKey || !!Client.keys["shift"];
    const directShiftLock = Client.settings.movementControlMode === "direct" && shiftClick;
    Client.mouse.lmb = !directShiftLock;
    if (directShiftLock) setCursorLock(false, getCanvasElement());

    // Map drag start
    if (Client.showMap && e.target instanceof Element && isBlockedByUi(e.target, getUiPointerBlockSelector())) {
      const mapOverlay = e.target.closest("#map-overlay, #hud-win-body-map");
      if (mapOverlay) {
        Client.mapDragging = true;
        Client.mapDragLastSx = e.clientX;
        Client.mapDragLastSy = e.clientY;
        return;
      }
    }

    if (isBlockedByUi(e.target, getUiPointerBlockSelector())) return;

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
    } else {
      if (Client.settings.movementControlMode === "waypoint") {
        Client.mouse.rmb = true;
        Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
        clearNav();
      }
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
  
  if (Client.mouse.rmb && Client.settings.movementControlMode === "waypoint") {
    Client.waypoint = { x: Client.mouseWorld.x, y: Client.mouseWorld.y };
  }
}

export function handleWheel(e: WheelEvent): void {
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
}

export function handleContextMenu(e: Event): void {
  if (e.target instanceof Element && e.target.closest(".hud-slot[data-rack='turret']")) return;
  e.preventDefault();
}

export function handleWindowBlur(): void {
  clearAllInputState();
  const canvas = getCanvasElement();
  if (!canvas) return;
  setCursorLock(true, canvas);
}
