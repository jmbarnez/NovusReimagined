/**
 * Pure navigation-force computation for the player ship.
 *
 * Returns desired thrust direction (ax, ay), angular acceleration (at),
 * and whether the ship should show thrustFx.  No state mutation.
 */
import { angleDiff, aimAngle } from "../utils/math.js";
import { C } from "../config/index.js";
import { enemyByLockId } from "../targeting.js";
import type { Player } from "../state.js";

export interface ShipNavForces {
  ax: number;
  ay: number;
  at: number;
  thrustFx: boolean;
}

export function computeShipNavForces(
  p: Player,
  inputKeys: Record<string, boolean>,
  inputMouseWorld: { x: number; y: number } | null,
  uiBlocksInput: boolean,
  cursorUnlocked: boolean,
  isLocalPresentation: boolean,
): ShipNavForces {
  let ax = 0;
  let ay = 0;
  let at = 0;
  let thrustFx = false;

  const manualForward = !!inputKeys?.w;
  const manualReverse = !!inputKeys?.s;
  const manualLeft = !!inputKeys?.a;
  const manualRight = !!inputKeys?.d;
  const manualMove = manualForward || manualReverse || manualLeft || manualRight;

  // Autopilot: Strategic maneuvers (Orbit / Keep at Range)
  if (p.navCommand && !uiBlocksInput && !manualMove) {
    const nav = p.navCommand;
    const target = enemyByLockId(nav.targetId);
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx);
      const hysteresis = 30;

      if (nav.mode === "orbit") {
        let desiredAngle = targetAngle;
        if (d > nav.rangePx + hysteresis) {
          desiredAngle = targetAngle;
        } else if (d < nav.rangePx - hysteresis) {
          desiredAngle = targetAngle + Math.PI;
        } else {
          desiredAngle = targetAngle + (Math.PI / 2) * nav.dir;
        }
        at = angleDiff(p.angle, desiredAngle) * C.PHYSICS.SHIP.turnRateMultiplier;
        ax = Math.cos(desiredAngle);
        ay = Math.sin(desiredAngle);
        thrustFx = true;
      } else if (nav.mode === "keepRange") {
        at = angleDiff(p.angle, targetAngle) * C.PHYSICS.SHIP.turnRateMultiplier;
        if (d > nav.rangePx + hysteresis) {
          ax = Math.cos(targetAngle);
          ay = Math.sin(targetAngle);
          thrustFx = true;
        } else if (d < nav.rangePx - hysteresis) {
          ax = -Math.cos(targetAngle);
          ay = -Math.sin(targetAngle);
          thrustFx = true;
        }
      }
    }
  } else if (p.waypoint && !uiBlocksInput && !manualMove) {
    const wp = p.waypoint;
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const dist = Math.hypot(dx, dy);
    const wpAngle = Math.atan2(dy, dx);

    if (dist >= 30) {
      at = angleDiff(p.angle, wpAngle) * C.PHYSICS.SHIP.turnRateMultiplier;
      ax = Math.cos(wpAngle);
      ay = Math.sin(wpAngle);
      thrustFx = true;
    }
  } else if (!uiBlocksInput && manualMove) {
    if (manualForward !== manualReverse) {
      const thrustDir = manualForward ? 1 : -1;
      ax = Math.cos(p.angle) * thrustDir;
      ay = Math.sin(p.angle) * thrustDir;
      thrustFx = true;
    }
    if (manualLeft !== manualRight) {
      at = (manualRight ? 1 : -1) * C.PHYSICS.SHIP.turnRateMultiplier;
    }
  } else if (!uiBlocksInput && inputMouseWorld && (!isLocalPresentation || !cursorUnlocked) && p.movementControlMode !== "direct") {
    const targetAngle = aimAngle(p.x, p.y, inputMouseWorld.x, inputMouseWorld.y);
    at = angleDiff(p.angle, targetAngle) * C.PHYSICS.SHIP.turnRateMultiplier;
  }

  return { ax, ay, at, thrustFx };
}
