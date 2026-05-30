import { Client, AppMode } from "../state.js";
import { emit } from "../events.js";

/**
 * Orchestrates a state transition to a new game mode.
 * Centralizes logs and triggers corresponding cross-module event notifications.
 */
export function transitionTo(newMode: AppMode): void {
  const prevMode = Client.mode;
  if (prevMode === newMode) {
    return; // Redundant transition, bypass
  }

  console.info(`[App FSM] Transitioning: ${prevMode} ➔ ${newMode}`);
  Client.mode = newMode;

  emit("app:mode-change", { mode: newMode, prevMode });
}
