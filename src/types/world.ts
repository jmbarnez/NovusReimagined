/**
 * Barrel re-export for all world entity structural types.
 *
 * Prefer importing from the specific domain file (e.g. `types/enemy.js`)
 * when only one entity family is needed; use this barrel when you need
 * several types and brevity matters.
 */

export type { ModuleDef } from "../data/modules.js";
export { ModuleInstance } from "./moduleInstance.js";
export type { Player } from "../state.js";

export * from "./combat.js";
export * from "./enemy.js";
export * from "./asteroid.js";
export * from "./station.js";
export * from "./system.js";
