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
import { initPixiCelestial, destroyPixiCelestial } from "../render/pixi-celestial.js";
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
  for (let i = 0; i < 18; i++) {
    const a = baseAngle + (random() - 0.5) * 0.9;
    const r = gate.radius * (0.25 + random() * 0.7);
    const theta = random() * Math.PI * 2;
    const sp = 120 + random() * 260;
    addParticle({
      x: gate.x + Math.cos(theta) * r,
      y: gate.y + Math.sin(theta) * r,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + random() * 0.35,
      color: random() > 0.35 ? "#a6e8ff" : "#ffffff",
      r: 2 + random() * 3,
      drag: 0.12,
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
  } else if (!spawnNearStationFallback(targetIdx, p)) {
    console.warn(`[warp] system ${targetIdx} has no reciprocal gate or station; spawning at origin`);
    PlayerAccess.updatePhysics({ x: 0, y: 0 }, p);
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

function tickPlayerWarp(dt: number, p: Player): void {
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
