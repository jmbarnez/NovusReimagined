/**
 * Simulation entity lifecycle orchestration.
 *
 * {@link clearSimulationEntities} is the single canonical reset path: it
 * releases every pooled entity type back to its pool, truncates the live
 * arrays, and clears every component store keyed by entity ID. Adding a new
 * entity type or component store requires wiring its clear helper in here —
 * omissions surface as compile errors because each clear is imported.
 */
import { clearVisualState } from "../../render/entity-visuals.js";
import { clearAiState } from "../../physics/npcs/ai-state.js";
import { clearTaskState } from "../../physics/npcs/task-state.js";
import { clearNpcSpeech } from "../../render/npc-speech.js";
import { clearPlayerInput } from "../../player/input-state.js";
import { clearCollisionCooldowns } from "../../player/collision-state.js";
import { clearAssignTargetIds } from "../../player/target-selection.js";
import { clearBullets, clearEnemyBullets } from "./bullets.js";
import { clearBeams } from "./beams.js";
import { clearParticles } from "./particles.js";
import { clearFloatTexts } from "./float-texts.js";
import { clearShockwaves } from "./shockwaves.js";
import { clearTrails } from "./trails.js";
import { clearImpactDecals } from "./impact-decals.js";
import { clearWreckAndSalvage } from "./wreck-salvage.js";

export function clearSimulationEntities() {
  clearBullets();
  clearEnemyBullets();
  clearBeams();
  clearParticles();
  clearShockwaves();
  clearFloatTexts();
  clearTrails();
  clearWreckAndSalvage();
  clearImpactDecals();
  clearVisualState();
  clearAiState();
  clearTaskState();
  clearNpcSpeech();
  clearPlayerInput();
  clearCollisionCooldowns();
  clearAssignTargetIds();
}

/**
 * Iterates a list in reverse, calls perTick for each item, and splices out
 * items when perTick returns true. Reverse iteration keeps splice indices valid.
 */
export function tickAndCull<T>(
  list: T[],
  dt: number,
  perTick: (item: T, dt: number, idx: number) => boolean | void,
  remove: (idx: number) => void,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (perTick(list[i], dt, i) === true) remove(i);
  }
}

/** True when a lockable target (enemy/asteroid/wreck) is gone. Respects the
 *  structure layer — an enemy with hull at 0 but structure left is still alive. */
export function isTargetDestroyed(
  t: { alive?: boolean; depleted?: boolean; hp?: number; structure?: number } | null | undefined,
): boolean {
  if (!t) return true;
  return (
    t.alive === false ||
    t.depleted === true ||
    ((t.hp ?? 0) <= 0 && (t.structure ?? 0) <= 0)
  );
}
