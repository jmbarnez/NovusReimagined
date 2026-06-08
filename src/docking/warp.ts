import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { emit } from "../events.js";
import { savePlayer } from "../player/player-data.js";
import { addParticle, clearSimulationEntities } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { allActivePlayers, curSys } from "../utils/game.js";
import { clearSensorLocks } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { populateSystem } from "../world-gen.js";
import { stationLayer } from "../pixi.js";
import { initPixiCelestial, destroyPixiCelestial } from "../render/celestial/index.js";
import { initGateSprites } from "../render/celestial/gates.js";
import type { Gate } from "../types/world.js";
import { canWarpThroughGate, shouldShowWarpGate } from "../data/tutorial.js";
import { C } from "../config/index.js";
import { didCrossGateAperture, gateChargeRadius, gateDestinationName, gateStableId } from "../utils/warp-gates.js";
import { sfxWarpCharge, sfxWarpJump } from "../audio/procedural/movement.js";

function logDockEvent(msg: string, type: string = "system"): void {
  if (typeof window === "undefined") return;
  void import("../ui/hud-overlay.js")
    .then((m) => m.logEvent(msg, type))
    .catch(() => {
      // Ignore UI logging failures in non-UI runtimes.
    });
}

function playWarpAudio(kind: "charge" | "jump"): void {
  if (typeof window === "undefined") return;
  void import("../audio/procedural.js")
    .then((m) => {
      if (kind === "charge") m.sfxWarpCharge();
      else m.sfxWarpJump();
    })
    .catch(() => {
      // Ignore audio init failures in headless runtimes.
    });
}

function spawnGateWarpBurst(gate: Gate, p: Player): void {
  if (p !== getState().player) return;
  const travelAngle = Math.atan2(p.y - p.py, p.x - p.px);
  const baseAngle = Number.isFinite(travelAngle) ? travelAngle : p.angle;
  for (let i = 0; i < 32; i++) {
    const a = baseAngle + (random() - 0.5) * 0.9;
    const r = gate.radius * (0.25 + random() * 0.7);
    const theta = random() * Math.PI * 2;
    const sp = 200 + random() * 100;
    addParticle({
      x: gate.x + Math.cos(theta) * r,
      y: gate.y + Math.sin(theta) * r,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + random() * 0.3,
      color: "#aaddff",
      r: 1 + random() * 1,
      drag: 0.08,
    });
  }
}

export function warpTo(gate: Gate, p: Player = getState().player) {
  const crossSys = gate.targetSysIdx !== undefined && gate.targetSysIdx !== null;
  PlayerAccess.setWarpCooldown(0.3, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
  PlayerAccess.updatePhysics({
    x: gate.target.x,
    y: gate.target.y - 320,
    px: gate.target.x,
    py: gate.target.y - 320,
    vx: 0,
    vy: 0,
  }, p);
  PlayerAccess.setInvincible(1.5, p);
  clearSensorLocks(p);
  if (crossSys && typeof gate.targetSysIdx === "number") {
    PlayerAccess.setSysIdx(gate.targetSysIdx, p);
    const targetSys = getState().GALAXY[gate.targetSysIdx];
    if (targetSys && !targetSys._ready) {
      populateSystem(targetSys);
    }
    if (p === getState().player) {
      emit("sector:crossed", { toIdx: gate.targetSysIdx });
      destroyPixiCelestial();
      if (targetSys && stationLayer) initPixiCelestial(stationLayer, targetSys);
    }
  }
  if (p === getState().player) {
    const actionLabel = crossSys ? `WARPED TO ${gate.target.label.toUpperCase()}` : `RETURNED TO ${gate.target.label.toUpperCase()}`;
    floatText(p.x, p.y - 55, actionLabel, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(crossSys ? `Warped to ${gate.target.label}` : `Returned to ${gate.target.label}`, "system");
    savePlayer();
  }
}

export function beginWarpThroughGate(gate: Gate, p: Player = getState().player): boolean {
  const sys = curSys(p);
  if (!sys) {
    return false;
  }
  if ((p.warpCooldown ?? 0) > 0) {
    return false;
  }
  if (!shouldShowWarpGate(gate, sys.idx, p)) {
    return false;
  }
  if (!canWarpThroughGate(gate, sys.idx, p)) {
    return false;
  }
  // Instant warp — no travel delay
  warpTo(gate, p);

  // Gate enters cooldown / spin-down; other players can't use it
  gate.gateState = "cooldown";
  gate.cooldownTimer = GATE_COOLDOWN;
  gate.chargeProgress = 1;
  spawnGateWarpBurst(gate, p);
  return true;
}

const CHARGE_TIME = 2.0;
const GATE_COOLDOWN = 3.0;
const DISPENSE_LIFETIME = 3.0;

// Client-side charge tracking for immediate visual feedback (server owns authoritative state)
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

  // Build candidates first so we can target charge progress at the best gate
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

  // Pick nearest in-range gate, or just nearest gate
  candidates.sort((a, b) => {
    const scoreA = (a.inRange ? 2 : 0) - a.distance;
    const scoreB = (b.inRange ? 2 : 0) - b.distance;
    return scoreB - scoreA;
  });
  const best = candidates[0];

  // Only accumulate charge for the best gate when eligible
  if (best.inRange && isHoldingWarp && best._canWarp && warpCooldown <= 0) {
    const prevProgress = clientChargeProgress;
    clientChargeProgress = Math.min(1, clientChargeProgress + dt / CHARGE_TIME);
    best.chargeProgress = Math.max(best.chargeProgress, clientChargeProgress);

    // Play charge sound when charging starts
    if (prevProgress === 0 && clientChargeProgress > 0) {
      sfxWarpCharge();
    }

    // Play jump sound when charge completes (client-side prediction)
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

function createTemporaryGate(sysIdx: number, x: number, y: number, fromIdx: number): void {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return;

  // Check if gate already exists at this location
  const existingGate = sys.gates?.find(g =>
    Math.hypot(g.x - x, g.y - y) < 10 && g.target.label === `from-${fromIdx}`
  );
  if (existingGate) return;

  // Create temporary gate
  const tempGate: Gate = {
    x,
    y,
    px: x,
    py: y,
    target: {
      kind: "local",
      x: 0,
      y: 0,
      label: `from-${fromIdx}`,
    },
    radius: 60,
    spin: 0,
    gateState: "active",
    chargeProgress: 1,
    dispenseTimer: DISPENSE_LIFETIME,
    isTemporary: true,
    activationRadius: 60 * (C.WORLD.GATES.activationRadiusMult ?? 2.0),
    fxProfile: "temporary",
  };
  
  if (!sys.gates) sys.gates = [];
  sys.gates.push(tempGate);
  
  // Particle burst on dispense gate spawn
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
  
  // Reinitialize gate sprites if this is the current system
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
      // Update dispense timer
      if (gate.dispenseTimer !== undefined && gate.dispenseTimer !== null) {
        gate.dispenseTimer -= dt;
        if (gate.dispenseTimer <= 0) {
          // Remove temporary gate (handled by system repopulation)
          gate.dispenseTimer = null;
        }
      }
      continue;
    }

    // Skip gates on cooldown — can't be charged by anyone until spin-down completes
    if (gate.gateState === "cooldown") continue;

    // Initialize state if not set
    if (!gate.gateState) gate.gateState = "dormant";
    if (gate.chargeProgress === undefined) gate.chargeProgress = 0;

    const activationRadius = gateChargeRadius(gate);
    // Check if G is being held and player is in range
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
        if (candidateScore > currentScore) {
          nextHint = candidate;
        }
      }
    }

    const canWarp = canWarpThroughGate(gate, sys.idx, p);
    if (inRange && isHoldingWarp && (p.warpCooldown ?? 0) <= 0) {
      // Start charging
      if (gate.gateState === "dormant") {
        gate.gateState = "charging";
        p.warpHoldStartTime = performance.now();
      }

      if (gate.gateState === "charging") {
        gate.chargeProgress += dt / CHARGE_TIME;
        if (gate.chargeProgress >= 1 && canWarpThroughGate(gate, sys.idx, p)) {
          gate.chargeProgress = 1;
          gate.gateState = "active";
          // Auto-warp when fully charged
          beginWarpThroughGate(gate, p);
        }
      }
    } else {
      // Reset only if gate is charging or active — never interrupt cooldown
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
        gate.chargeProgress = gate.cooldownTimer / GATE_COOLDOWN;
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
  // Server-side charging; warp triggers instantly when charge completes
  updateGateActivation(dt, p);

  // Tick down the brief player re-warp cooldown (not the old long travel time)
  if ((p.warpCooldown ?? 0) > 0) {
    PlayerAccess.setWarpCooldown(Math.max(0, (p.warpCooldown ?? 0) - dt), p);
  }
}

export function updateWarp(dt: number): void {
  tickGateCooldowns(dt);
  for (const p of allActivePlayers()) tickPlayerWarp(dt, p);
}
