import { type Player } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import {
  TUTORIAL_BOOST_GATES,
  getActiveTutorialTracks,
  detectGateCrossing,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";

const GATE_COOLDOWN = 3.0;
const BOOST_IMPULSE = 240;
const BOOST_DURATION = 1.5;

export function resetTutorialTrackState(_p: Player): void {
  // No-op: per-player gate state is cleared via server init / snapshot reset.
}

export function getTutorialGateCooldown(gateId: string, p: Player): number {
  return p.gateCooldowns?.[gateId] ?? 0;
}

export function getTutorialGatesClearedCount(trackId: string, p: Player): number {
  const ids = new Set(
    TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => g.trackId === trackId).map((g: TutorialBoostGate) => g.id),
  );
  return (p.gatesCleared ?? []).filter((id: string) => ids.has(id)).length;
}

export function getTutorialGateTotalCount(trackId: string): number {
  return TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => g.trackId === trackId).length;
}

function getActiveBoostGates(stepId: string): TutorialBoostGate[] {
  const activeTrackIds = new Set(getActiveTutorialTracks(stepId).map((t: { id: string }) => t.id));
  return TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => activeTrackIds.has(g.trackId));
}

function applyGateBoost(p: Player, gate: TutorialBoostGate): void {
  const nx = Math.cos(gate.angle);
  const ny = Math.sin(gate.angle);
  PlayerAccess.updatePhysics(
    { vx: p.vx + nx * BOOST_IMPULSE, vy: p.vy + ny * BOOST_IMPULSE },
    p,
  );
  PlayerAccess.setGateBoostRemaining(BOOST_DURATION, p);
}

export function updateTutorialTrack(dt: number, p: Player, _isReplaying = false): void {
  if (!p?.tutorial?.active || p.sysIdx !== 0) return;

  // Decrement gate cooldowns
  const cds = p.gateCooldowns ?? {};
  let changed = false;
  for (const id of Object.keys(cds)) {
    if (cds[id]! > 0) {
      cds[id] = Math.max(0, cds[id]! - dt);
      changed = true;
    }
  }
  if (changed) {
    PlayerAccess.setGateCooldowns({ ...cds }, p);
  }

  const step = getCurrentTutorialStep(p);
  if (!step) return;

  const activeGates = getActiveBoostGates(step.id);
  if (activeGates.length === 0) return;

  for (const gate of activeGates) {
    if (cds[gate.id]! > 0) continue;
    const crossed = detectGateCrossing(
      gate,
      p.px, p.py,
      p.x, p.y,
      p.vx, p.vy,
    );
    if (crossed) {
      applyGateBoost(p, gate);
      cds[gate.id] = GATE_COOLDOWN;
      PlayerAccess.setGateCooldowns({ ...cds }, p);
      const cleared = new Set(p.gatesCleared ?? []);
      cleared.add(gate.id);
      PlayerAccess.setGatesCleared([...cleared], p);
    }
  }
}
