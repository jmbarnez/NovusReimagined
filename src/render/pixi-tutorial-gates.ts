/**
 * Tutorial boost gates — GPU mesh renderer.
 *
 * Replaces the old Graphics-based line-and-cap drawing with a single GPU
 * Mesh + custom shader (see `pixi-boost-gate-mesh.ts`). The shader draws a
 * plasma curtain, glowing pillars, traveling sweep pulses, drifting sparks,
 * proximity charge-up, and an activation flash on pass-through.
 */
import { getState } from "../state-access.js";
import { isVisible } from "../utils/game.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import {
  TUTORIAL_BOOST_GATES,
  getActiveTutorialTracks,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";
import {
  buildBoostGateMesh,
  syncBoostGateMesh,
  destroyBoostGateMesh,
  computeGateCharge,
  computeGateFlash,
  type BoostGateRenderData,
} from "./pixi-boost-gate-mesh.js";

/** Stable per-gate seed derived from the gate id (deterministic across frames). */
function gateSeed(gateId: string): number {
  let h = 0;
  for (let i = 0; i < gateId.length; i++) {
    h = (h * 31 + gateId.charCodeAt(i)) | 0;
  }
  return ((h % 1000) + 1000) % 1000 / 1000;
}

function getActiveBoostGates(stepId: string): TutorialBoostGate[] {
  const activeTrackIds = new Set(getActiveTutorialTracks(stepId).map((t: { id: string }) => t.id));
  return TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => activeTrackIds.has(g.trackId));
}

export function refreshTutorialGateFonts(): void {
  // No-op: boost gates use a GPU shader, no text.
}

export function initPixiTutorialGates(): void {
  buildBoostGateMesh();
}

export function syncPixiTutorialGates(now: number): void {
  initPixiTutorialGates();

  const player = getState().player;
  if (!player?.tutorial?.active || player.sysIdx !== 0) {
    syncBoostGateMesh(now, []);
    return;
  }

  const step = getCurrentTutorialStep(player);
  const activeGates = step ? getActiveBoostGates(step.id) : [];
  if (activeGates.length === 0) {
    syncBoostGateMesh(now, []);
    return;
  }

  const cooldowns = player.gateCooldowns ?? {};
  const renderData: BoostGateRenderData[] = activeGates.map((g) => {
    const visible = isVisible(g.x, g.y, g.halfWidth + 120);
    const charge = visible
      ? computeGateCharge(g.x, g.y, g.angle, g.halfWidth, player.x, player.y)
      : 0;
    const flash = computeGateFlash(cooldowns[g.id] ?? 0);
    return {
      id: g.id,
      x: g.x,
      y: g.y,
      angle: g.angle,
      halfWidth: g.halfWidth,
      visible,
      charge,
      flash,
      seed: gateSeed(g.id),
    };
  });

  syncBoostGateMesh(now, renderData);
}

export function destroyPixiTutorialGates(): void {
  destroyBoostGateMesh();
}
