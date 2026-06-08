import { random } from "../utils/math.js";
import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import {
  TUTORIAL_BOOST_GATES,
  getBoostGatesForTrack,
  detectGateCrossing,
  gatePillarPositions,
  getGateControlHint,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";
import { addParticle } from "../utils/entities.js";
import { logEvent } from "../feedback.js";

const gateHintsShown = new Set<string>();

export function resetTutorialTrackState(p: Player): void {
  p.gateCooldowns = {};
  p.gatesCleared = [];
  gateHintsShown.clear();
}

export function getTutorialGateCooldown(gateId: string, p: Player): number {
  return p.gateCooldowns?.[gateId] ?? 0;
}

export function getTutorialGatesClearedCount(trackId: string, p: Player): number {
  if (!p.gatesCleared) return 0;
  let n = 0;
  for (const gate of getBoostGatesForTrack(trackId)) {
    if (p.gatesCleared.includes(gate.id)) n++;
  }
  return n;
}

export function getTutorialGateTotalCount(trackId: string): number {
  return getBoostGatesForTrack(trackId).length;
}

function playerCrossedGate(gate: TutorialBoostGate, p: Player): boolean {
  return detectGateCrossing(gate, p.x, p.y, p.px, p.py, p.vx, p.vy);
}

function applyGateBoost(gate: TutorialBoostGate, p: Player, isReplaying = false): void {
  if (!p.gateCooldowns) p.gateCooldowns = {};
  p.gateCooldowns[gate.id] = gate.cooldownS;
  if (!p.gatesCleared) p.gatesCleared = [];
  if (!p.gatesCleared.includes(gate.id)) {
    p.gatesCleared.push(gate.id);
  }

  const nx = Math.cos(gate.angle);
  const ny = Math.sin(gate.angle);
  const isForward = (p.vx * nx + p.vy * ny) >= 0;
  const dir = isForward ? 1 : -1;

  const vx = p.vx + nx * gate.strength * dir;
  const vy = p.vy + ny * gate.strength * dir;
  PlayerAccess.updatePhysics({ vx, vy }, p);
  PlayerAccess.setGateBoostRemaining(1.5, p);

  if (isReplaying) return;

  const { left, right } = gatePillarPositions(gate);
  const baseAngle = gate.angle + (isForward ? 0 : Math.PI);
  for (let i = 0; i < 32; i++) {
    const t = random();
    const bx = left.x + (right.x - left.x) * t;
    const by = left.y + (right.y - left.y) * t;
    const a = baseAngle + (random() - 0.5) * 0.5;
    const sp = 180 + random() * 100;
    addParticle({
      x: bx + (random() - 0.5) * 8,
      y: by + (random() - 0.5) * 8,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6 + random() * 0.3,
      color: "#aaddff",
      r: 1 + random() * 1,
    });
  }
  if (p === getState().player) {
    getState().pendingEffects.push({
      type: "blip",
      payload: { x: 720 + random() * 240, y: 0.06 },
    });
  }
}

function tickGateHints(gates: TutorialBoostGate[], p: Player): void {
  for (const gate of gates) {
    const hint = getGateControlHint(gate);
    if (!hint || gateHintsShown.has(gate.id)) continue;
    if (Math.hypot(p.x - gate.x, p.y - gate.y) > 720) continue;
    gateHintsShown.add(gate.id);
    if (p === getState().player) {
      logEvent(hint, "system");
    }
  }
}

function tickBoostGates(dt: number, gates: TutorialBoostGate[], p: Player, isReplaying = false): void {
  if (!p.gateCooldowns) p.gateCooldowns = {};
  for (const gate of gates) {
    const cd = p.gateCooldowns[gate.id] ?? 0;
    if (cd > 0) p.gateCooldowns[gate.id] = Math.max(0, cd - dt);
  }

  tickGateHints(gates, p);

  for (const gate of gates) {
    if ((p.gateCooldowns[gate.id] ?? 0) > 0) continue;
    if (!playerCrossedGate(gate, p)) continue;
    applyGateBoost(gate, p, isReplaying);
  }
}

/** Slingshot boost gates — fly through the arch between pillars. */
export function updateTutorialTrack(dt: number, p: Player, isReplaying = false): void {
  if (p.sysIdx !== 0 || (p === getState().player && Client.stationOpen)) return;

  tickBoostGates(dt, TUTORIAL_BOOST_GATES, p, isReplaying);
}
