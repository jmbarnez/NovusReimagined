/**
 * Pure navigation-force computation for the player ship.
 *
 * Returns desired thrust direction (ax, ay), angular acceleration (at),
 * and whether the ship should show thrustFx.  No state mutation.
 */
import { C } from "../config/index.js";
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
  _inputMouseWorld: { x: number; y: number } | null,
  uiBlocksInput: boolean,
): ShipNavForces {
  let ax = 0;
  let ay = 0;
  let at = 0;
  let thrustFx = false;

  const manualForward = !!inputKeys?.w;
  const manualBackward = !!inputKeys?.s;
  const manualLeft = !!inputKeys?.a;
  const manualRight = !!inputKeys?.d;

  if (!uiBlocksInput && (manualForward || manualBackward || manualLeft || manualRight)) {
    if (manualForward !== manualBackward) {
      const thrustDir = manualForward ? 1 : -1;
      ax = Math.cos(p.angle) * thrustDir;
      ay = Math.sin(p.angle) * thrustDir;
      thrustFx = true;
    }
    if (manualLeft !== manualRight) {
      at = (manualRight ? 1 : -1) * C.PHYSICS.SHIP.turnRateMultiplier;
    }
  }

  return { ax, ay, at, thrustFx };
}
