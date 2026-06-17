import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { addParticle } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { allActivePlayers, curSys } from "../utils/game.js";
import { initGateSprites } from "../render/celestial/gates.js";
import type { Gate } from "../types/station.js";
import { canWarpThroughGate } from "../data/tutorial.js";
import { C } from "../config/index.js";
import { gateChargeRadius, gateStableId } from "../utils/warp-gates.js";
import { beginWarpThroughGate } from "./warp-exec.js";


function createTemporaryGate(sysIdx: number, x: number, y: number, fromIdx: number): void {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return;

  const existingGate = sys.gates?.find(
    (g) => Math.hypot(g.x - x, g.y - y) < 10 && g.target.label === `from-${fromIdx}`,
  );
  if (existingGate) return;

  const tempGate: Gate = {
    x,
    y,
    px: x,
    py: y,
    target: { kind: "local", x: 0, y: 0, label: `from-${fromIdx}` },
    radius: 60,
    spin: 0,
    gateState: "active",
    chargeProgress: 1,
    dispenseTimer: C.WORLD.GATES.dispenseLifetimeBase,
    isTemporary: true,
    activationRadius: 60 * (C.WORLD.GATES.activationRadiusMult ?? 2.0),
    fxProfile: "temporary",
  };

  if (!sys.gates) sys.gates = [];
  sys.gates.push(tempGate);

  if (getState().player.sysIdx === sysIdx) {
    for (let i = 0; i < 24; i++) {
      const a = random() * Math.PI * 2;
      const r = 30 + random() * 40;
      const sp = 150 + random() * 100;
      addParticle({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + random() * 0.4,
        color: "#aaddff",
        r: 1 + random() * 1.5,
        drag: 0.1,
      });
    }
  }

  if (getState().player.sysIdx === sysIdx && getState().player === getState().player) {
    initGateSprites(sys);
  }
}

export function updateGateActivation(dt: number, p: Player): void {
  const sys = curSys(p);
  if (!sys) return;

  const isLocalPlayer = p === getState().player;
  let nextHint: typeof Client.warpGateHint = null;

  for (const gate of sys.gates ?? []) {
    if (gate.isTemporary) {
      if (gate.dispenseTimer !== undefined && gate.dispenseTimer !== null) {
        gate.dispenseTimer -= dt;
        if (gate.dispenseTimer <= 0) gate.dispenseTimer = null;
      }
      continue;
    }

    if (gate.gateState === "cooldown") continue;

    if (!gate.gateState) gate.gateState = "dormant";
    if (gate.chargeProgress === undefined) gate.chargeProgress = 0;

    const activationRadius = gateChargeRadius(gate);
    const playerHoldingWarp = p.inputKeys?.warp === true;
    const isHoldingWarp = playerHoldingWarp || (isLocalPlayer && Client.keys["warp"] === true);
    const dist = Math.hypot(p.x - gate.x, p.y - gate.y);
    const inRange = dist < activationRadius;

    if (isLocalPlayer) {
      const gateState = gate.gateState ?? "dormant";
      const candidate = {
        gateId: gateStableId(gate),
        gateLabel: gate.target.label,
        fxProfile: gate.fxProfile,
        distance: dist,
        activationRadius,
        gateState,
        chargeProgress: gate.chargeProgress ?? 0,
        inRange,
        isCharging: gateState === "charging",
      } satisfies typeof Client.warpGateHint;

      if (!nextHint) {
        nextHint = candidate;
      } else {
        const candidateScore = (candidate.inRange ? 2 : 0) - candidate.distance;
        const currentScore = (nextHint.inRange ? 2 : 0) - nextHint.distance;
        if (candidateScore > currentScore) nextHint = candidate;
      }
    }

    if (inRange && isHoldingWarp && (p.warpCooldown ?? 0) <= 0) {
      if (gate.gateState === "dormant") {
        gate.gateState = "charging";
        p.warpHoldStartTime = performance.now();
      }

      if (gate.gateState === "charging") {
        gate.chargeProgress += dt / C.WORLD.GATES.chargeTimeBase;
        if (gate.chargeProgress >= 1 && canWarpThroughGate(gate, sys.idx, p)) {
          gate.chargeProgress = 1;
          gate.gateState = "active";
          beginWarpThroughGate(gate, p);
        }
      }
    } else {
      if (gate.gateState === "charging" || gate.gateState === "active") {
        gate.gateState = "dormant";
        gate.chargeProgress = 0;
        p.warpHoldStartTime = null;
      }
    }
  }

  if (isLocalPlayer) {
    Client.warpGateHint = nextHint;
  }
}

function tickGateCooldowns(dt: number): void {
  for (const sys of getState().GALAXY) {
    if (!sys?.gates) continue;
    for (const gate of sys.gates) {
      if (gate.gateState === "cooldown" && typeof gate.cooldownTimer === "number") {
        gate.cooldownTimer = Math.max(0, gate.cooldownTimer - dt);
        gate.chargeProgress = gate.cooldownTimer / C.WORLD.GATES.cooldownTimeBase;
        if (gate.cooldownTimer <= 0) {
          gate.gateState = "dormant";
          gate.chargeProgress = 0;
          gate.cooldownTimer = undefined;
        }
      }
    }
  }
}

function tickPlayerWarp(dt: number, p: Player): void {
  updateGateActivation(dt, p);
  if ((p.warpCooldown ?? 0) > 0) {
    PlayerAccess.setWarpCooldown(Math.max(0, (p.warpCooldown ?? 0) - dt), p);
  }
}

export function updateWarp(dt: number): void {
  tickGateCooldowns(dt);
  for (const p of allActivePlayers()) tickPlayerWarp(dt, p);
}
