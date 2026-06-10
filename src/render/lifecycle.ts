/**
 * Render Phase Coordinator
 *
 * Central lifecycle manager for all PixiJS render subsystems.
 * Subsystems register via {@link registerSubsystem} with their init/sync/destroy
 * callbacks and the AppModes they run in. The coordinator calls init when entering
 * a matching phase, sync every frame while in that phase, and destroy when leaving.
 *
 * Usage:
 *   import { registerSubsystem, enterPhase, sync } from "./lifecycle.js";
 *   registerSubsystem(mySubsystem);
 *   enterPhase(AppMode.SPACE);   // inits all SPACE subsystems in order
 *   sync(ctx);                    // calls sync for current phase
 *   enterPhase(AppMode.TITLE);   // destroys SPACE-only, inits TITLE-only
 */

import { AppMode, Client } from "../state.js";
import { on } from "../events.js";
import type { System } from "../types/world.js";
import type { Player } from "../state/types/index.js";

export interface SyncContext {
  now: number;
  alpha: number;
  dt: number;
  width: number;
  height: number;
  camxR: number;
  camyR: number;
  sys: System;
  player: Player | null;
  tutorialActive: boolean;
  mapOpen: boolean;
  mapBounds: { width: number; height: number } | null;
}

export interface RenderSubsystem {
  name: string;
  /** Called once when entering a matching phase and not yet initialized. */
  init?: () => void;
  /** Called every frame while in a matching phase. */
  sync?: (ctx: SyncContext) => void;
  /** Called once when leaving a matching phase or on full teardown. */
  destroy?: () => void;
  /** Which modes this subsystem runs in. Empty array means always active. */
  modes: AppMode[];
  /** Lower numbers init earlier. Default 999. */
  order?: number;
}

const _registry: RenderSubsystem[] = [];
let _currentPhase: AppMode | null = null;
const _initialized = new Set<string>();

export function registerSubsystem(sub: RenderSubsystem): void {
  _registry.push(sub);
  _registry.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Enter a new render phase. Destroys subsystems that don't belong in the new
 * phase (in reverse order) and inits those that do (in forward order).
 */
export function enterPhase(phase: AppMode | null): void {
  // Destroy subsystems not valid in the new phase, or all if phase is null
  if (_currentPhase !== null) {
    for (let i = _registry.length - 1; i >= 0; i--) {
      const sub = _registry[i];
      if (_initialized.has(sub.name) && (!phase || !sub.modes.includes(phase))) {
        try {
          sub.destroy?.();
        } catch (err) {
          console.error(`[RenderLifecycle] destroy failed for "${sub.name}":`, err);
        }
        _initialized.delete(sub.name);
      }
    }
  }

  _currentPhase = phase;

  // Init subsystems valid in the new phase
  if (phase !== null) {
    for (const sub of _registry) {
      if (sub.modes.includes(phase) && !_initialized.has(sub.name)) {
        try {
          sub.init?.();
        } catch (err) {
          console.error(`[RenderLifecycle] init failed for "${sub.name}":`, err);
        }
        _initialized.add(sub.name);
      }
    }
  }
}

/** Dispatch sync to all initialized subsystems valid for the current phase. */
export function sync(ctx: SyncContext): void {
  if (!_currentPhase) return;
  for (const sub of _registry) {
    if (_initialized.has(sub.name) && sub.modes.includes(_currentPhase) && sub.sync) {
      try {
        sub.sync(ctx);
      } catch (err) {
        console.error(`[RenderLifecycle] sync failed for "${sub.name}":`, err);
      }
    }
  }
}

/** Tear down all initialized subsystems and reset state. */
export function destroy(): void {
  enterPhase(null);
}

/** Return the current phase. */
export function currentPhase(): AppMode | null {
  return _currentPhase;
}

/** Return true if a subsystem by name is currently initialized. */
export function isInitialized(name: string): boolean {
  return _initialized.has(name);
}

// Auto-react to app mode changes so gameplay code doesn't import the coordinator.
on("app:mode-change", ({ mode }) => {
  enterPhase(mode);
});
