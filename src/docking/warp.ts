import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { emit } from "../events.js";
import { savePlayer } from "../player/player-data.js";
import { addParticle, clearSimulationEntities } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { allActivePlayers, curSys } from "../utils/game.js";
import { GATE_RANGE, WARP_TIME } from "../constants.js";
import { clearSensorLocks } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { populateSystem } from "../world-gen.js";
import { stationLayer } from "../pixi.js";
import { initPixiCelestial, destroyPixiCelestial } from "../render/celestial/index.js";
import { initGateSprites } from "../render/celestial/gates.js";
import type { Gate } from "../types/world.js";
import { canWarpThroughGate, shouldShowWarpGate } from "../data/tutorial.js";
import { didCrossGateAperture, gateDestinationName, gateStableId, isLocalWarpGate } from "../utils/warp-gates.js";

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

export function getWarpGateInRange(p: Player = getState().player, targetIdx?: number | null): Gate | null {
  const sys = curSys(p);
  if (!sys || (p.warpCooldown ?? 0) > 0) return null;
  const lockedGateId = p.targetLock?.id ?? null;
  return sys.gates.find((g) =>
    (targetIdx == null || g.targetSysIdx === targetIdx)
    && lockedGateId === gateStableId(g)
    && canWarpThroughGate(g, sys.idx, p)
    && Math.hypot(p.x - g.x, p.y - g.y) < g.radius + GATE_RANGE
  ) ?? null;
}

function spawnNearStationFallback(targetIdx: number, p: Player): boolean {
  const station = getState().GALAXY[targetIdx]?.stations?.find((st) => !st.isProcessingHub)
    ?? getState().GALAXY[targetIdx]?.stations?.[0];
  if (!station) return false;
  const len = Math.hypot(station.x, station.y) || 1;
  const nx = len > 0.5 ? station.x / len : 1;
  const ny = len > 0.5 ? station.y / len : 0;
  const exit = station.radius + 240;
  PlayerAccess.updatePhysics({
    x: station.x + nx * exit + (Math.random() - 0.5) * 32,
    y: station.y + ny * exit + (Math.random() - 0.5) * 32,
  }, p);
  return true;
}

export function warpTo(targetIdx: number, p: Player = getState().player) {
  PlayerAccess.setWarpCooldown(2.5, p);
  if (p === getState().player) {
    clearSimulationEntities();
    emit("simulation:clear");
    destroyPixiCelestial();
  }
  const fromIdx = p.sysIdx;
  PlayerAccess.setSysIdx(targetIdx, p);
  if (p === getState().player) {
    populateSystem(getState().GALAXY[targetIdx]);
    const targetSys = getState().GALAXY[targetIdx];
    if (stationLayer && targetSys) initPixiCelestial(stationLayer, targetSys);
  }
  const gates = getState().GALAXY[targetIdx].gates;
  const back = gates?.find((g: Gate) => g.targetSysIdx === fromIdx);
  if (back) {
    const len = Math.hypot(back.x, back.y) || 1;
    const nx = back.x / len;
    const ny = back.y / len;
    const exit = back.radius + GATE_RANGE + 240;
    PlayerAccess.updatePhysics({
      x: back.x + nx * exit + (Math.random() - 0.5) * 32,
      y: back.y + ny * exit + (Math.random() - 0.5) * 32,
    }, p);
  } else {
    // Create temporary dispense gate if no reciprocal gate exists
    const dispenseX = -1000 + Math.random() * 2000;
    const dispenseY = -1000 + Math.random() * 2000;
    createTemporaryGate(targetIdx, dispenseX, dispenseY, fromIdx);
    
    const len = Math.hypot(dispenseX, dispenseY) || 1;
    const nx = len > 0.5 ? dispenseX / len : 1;
    const ny = len > 0.5 ? dispenseY / len : 0;
    const exit = 60 + GATE_RANGE + 240;
    PlayerAccess.updatePhysics({
      x: dispenseX + nx * exit + (Math.random() - 0.5) * 32,
      y: dispenseY + ny * exit + (Math.random() - 0.5) * 32,
    }, p);
  }
  PlayerAccess.updatePhysics({ px: p.x, py: p.y, vx: 0, vy: 0 }, p);
  PlayerAccess.setInvincible(2.0, p);
  clearSensorLocks(p);
  if (p === getState().player) {
    floatText(p.x, p.y - 55, `▶ ${getState().GALAXY[targetIdx].name}`, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(`Warped to ${getState().GALAXY[targetIdx].name}  (SEC ${getState().GALAXY[targetIdx].security.toFixed(1)})`, "system");
    savePlayer();
  }
}

function warpLocal(gate: Gate, p: Player): boolean {
  if (gate.target?.kind !== "local") return false;
  PlayerAccess.setWarpCooldown(2.5, p);
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
  if (p === getState().player) {
    floatText(p.x, p.y - 55, `RETURNED TO ${gate.target.label.toUpperCase()}`, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(`Returned to ${gate.target.label}`, "system");
    savePlayer();
  }
  return true;
}

export function beginWarpThroughGate(gate: Gate, p: Player = getState().player): boolean {
  const sys = curSys(p);
  if (!sys) return false;
  if ((p.warpCooldown ?? 0) > 0) return false;
  if (!shouldShowWarpGate(gate, sys.idx, p)) return false;
  if (!canWarpThroughGate(gate, sys.idx, p)) return false;
  if (isLocalWarpGate(gate)) {
    spawnGateWarpBurst(gate, p);
    return warpLocal(gate, p);
  }
  if (gate.targetSysIdx == null) return false;
  spawnGateWarpBurst(gate, p);
  PlayerAccess.setWarpCooldown(WARP_TIME, p);
  PlayerAccess.setWarpTargetIdx(gate.targetSysIdx, p);
  if (p === getState().player) {
    floatText(p.x, p.y - 45, `WARP to ${gateDestinationName(gate, getState().GALAXY)}`, "#66aaff");
    playWarpAudio("charge");
  }
  return true;
}

const ACTIVATION_RADIUS_MULT = 1.5;
const CHARGE_TIME = 2.0;
const DISPENSE_LIFETIME = 3.0;

function createTemporaryGate(sysIdx: number, x: number, y: number, fromIdx: number): void {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return;
  
  // Check if gate already exists at this location
  const existingGate = sys.gates?.find(g => 
    Math.hypot(g.x - x, g.y - y) < 10 && g.targetSysIdx === fromIdx
  );
  if (existingGate) return;
  
  // Create temporary gate
  const tempGate: Gate = {
    x,
    y,
    px: x,
    py: y,
    radius: 60,
    spin: 0,
    targetSysIdx: fromIdx,
    gateState: "active",
    chargeProgress: 1,
    dispenseTimer: DISPENSE_LIFETIME,
    isTemporary: true,
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

function updateGateActivation(dt: number, p: Player): void {
  const sys = curSys(p);
  if (!sys) return;
  
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
    
    const dist = Math.hypot(p.x - gate.x, p.y - gate.y);
    const activationRadius = gate.radius * ACTIVATION_RADIUS_MULT;
    
    // Initialize state if not set
    if (!gate.gateState) gate.gateState = "dormant";
    if (gate.chargeProgress === undefined) gate.chargeProgress = 0;
    
    if (dist < activationRadius && (p.warpCooldown ?? 0) <= 0) {
      // Player in range - start charging
      if (gate.gateState === "dormant") {
        gate.gateState = "charging";
      }
      
      if (gate.gateState === "charging") {
        gate.chargeProgress += dt / CHARGE_TIME;
        if (gate.chargeProgress >= 1) {
          gate.chargeProgress = 1;
          gate.gateState = "active";
          // Auto-warp when fully charged
          if (didCrossGateAperture(gate, p)) {
            beginWarpThroughGate(gate, p);
          }
        }
      }
    } else {
      // Player out of range - reset
      if (gate.gateState !== "dormant") {
        gate.gateState = "dormant";
        gate.chargeProgress = 0;
      }
    }
  }
}

function tickPlayerWarp(dt: number, p: Player): void {
  // Update gate activation states
  updateGateActivation(dt, p);
  
  if ((p.warpCooldown ?? 0) > 0) {
    PlayerAccess.setWarpCooldown((p.warpCooldown ?? 0) - dt, p);
    if ((p.warpCooldown ?? 0) <= 0) {
      const targetIdx = p.warpTargetIdx ?? -1;
      PlayerAccess.setWarpCooldown(0, p);
      if (targetIdx >= 0) warpTo(targetIdx, p);
      PlayerAccess.setWarpTargetIdx(-1, p);
    }
    return;
  }

  if (p === getState().player && Client.stationOpen) return;
  const sys = curSys(p);
  if (!sys) return;
  for (const gate of sys.gates ?? []) {
    if (!didCrossGateAperture(gate, p)) continue;
    if (beginWarpThroughGate(gate, p)) return;
  }
}

export function updateWarp(dt: number): void {
  for (const p of allActivePlayers()) tickPlayerWarp(dt, p);
}

export function tryWarp(p: Player = getState().player, targetIdx?: number | null): boolean {
  const gate = getWarpGateInRange(p, targetIdx);
  if (!gate) return false;
  if (isLocalWarpGate(gate)) return warpLocal(gate, p);
  if (gate.targetSysIdx == null) return false;
  PlayerAccess.setWarpCooldown(WARP_TIME, p);
  PlayerAccess.setWarpTargetIdx(gate.targetSysIdx, p);
  if (p === getState().player) {
    floatText(p.x, p.y - 45, `WARP to ${gateDestinationName(gate, getState().GALAXY)}`, "#66aaff");
    playWarpAudio("charge");
  }
  return true;
}

export function clearWarpPresentation(p: Player = getState().player): void {
  PlayerAccess.setWarpCooldown(0, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
}
