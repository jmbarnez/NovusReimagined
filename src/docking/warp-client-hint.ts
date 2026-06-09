import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { canWarpThroughGate } from "../data/tutorial.js";
import { gateChargeRadius, gateStableId } from "../utils/warp-gates.js";
import { sfxWarpCharge, sfxWarpJump } from "../audio/procedural/movement.js";
import { C } from "../config/index.js";

let clientChargeProgress = 0;
let lastWarpGateId: string | null = null;

export function updateClientWarpHint(dt: number): void {
  if (typeof window === "undefined") return;
  const player = getState().player;
  if (!player) return;
  const sys = curSys(player);
  if (!sys) return;

  const isHoldingWarp = Client.keys["warp"] === true;
  const warpCooldown = player.warpCooldown ?? 0;

  const candidates: Array<NonNullable<typeof Client.warpGateHint> & { _canWarp: boolean }> = [];
  for (const gate of sys.gates ?? []) {
    if (gate.isTemporary || gate.gateState === "cooldown") continue;
    const activationRadius = gateChargeRadius(gate);
    const dist = Math.hypot(player.x - gate.x, player.y - gate.y);
    const inRange = dist < activationRadius;
    const gateState = gate.gateState ?? "dormant";
    const canWarp = canWarpThroughGate(gate, sys.idx, player);

    candidates.push({
      gateId: gateStableId(gate),
      gateLabel: gate.target.label,
      fxProfile: gate.fxProfile,
      distance: dist,
      activationRadius,
      gateState,
      chargeProgress: gate.chargeProgress ?? 0,
      inRange,
      isCharging: false,
      _canWarp: canWarp,
    });
  }

  if (candidates.length === 0) {
    Client.warpGateHint = null;
    clientChargeProgress = 0;
    lastWarpGateId = null;
    return;
  }

  candidates.sort((a, b) => {
    const scoreA = (a.inRange ? 2 : 0) - a.distance;
    const scoreB = (b.inRange ? 2 : 0) - b.distance;
    return scoreB - scoreA;
  });
  const best = candidates[0];

  if (best.inRange && isHoldingWarp && best._canWarp && warpCooldown <= 0) {
    const prevProgress = clientChargeProgress;
    clientChargeProgress = Math.min(1, clientChargeProgress + dt / C.WORLD.GATES.chargeTimeBase);
    best.chargeProgress = Math.max(best.chargeProgress, clientChargeProgress);

    if (prevProgress === 0 && clientChargeProgress > 0) {
      sfxWarpCharge();
    }
    if (prevProgress < 1 && clientChargeProgress >= 1) {
      sfxWarpJump();
    }
  } else {
    clientChargeProgress = 0;
    lastWarpGateId = null;
  }

  best.isCharging = best.chargeProgress > 0 && best.chargeProgress < 1 && best.inRange && isHoldingWarp;
  Client.warpGateHint = best;
}
