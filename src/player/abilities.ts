/**
 * Active abilities — fired by activating a module that has an `ability` tag.
 *
 * Each ability has a cooldown, a cap cost, and an optional active duration
 * during which a movement/defence multiplier applies. The module hotkey path
 * in player-fitting.ts calls tryActivate() instead of toggling the slot when
 * the equipped module exposes an ability.
 *
 * Cooldown state lives module-local (keyed by ability id) so it does not
 * pollute the saved Player shape.
 */
import { G } from "../state.js";
import { addTrailSegment } from "../utils/entities.js";

export interface AbilityDef {
  id: string;
  name: string;
  cooldown: number;     // seconds
  capCost: number;
  /** Duration in seconds the effect remains active after activation. 0 = instant. */
  duration: number;
  description: string;
  /** Multipliers applied while ability is active. Read by physics/ship.ts. */
  thrustMult?: number;
  speedMult?: number;
  /** Hook executed once at activation. Return false to abort. */
  onActivate?: () => boolean | void;
}

export const ABILITIES: AbilityDef[] = [
  {
    id: "blink",
    name: "Warp Burst",
    cooldown: 8,
    capCost: 25,
    duration: 0,
    description: "Short-range jump along current heading.",
    onActivate: () => {
      const BLINK_DIST = 320;
      const c = Math.cos(G.P.angle), s = Math.sin(G.P.angle);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        addTrailSegment({
          x: G.P.x + c * BLINK_DIST * t,
          y: G.P.y + s * BLINK_DIST * t,
          color: "#9ad8ff",
          width: 3,
          life: 0.45,
        });
      }
      G.P.x += c * BLINK_DIST;
      G.P.y += s * BLINK_DIST;
      G.P.px = G.P.x; G.P.py = G.P.y;
      if ((G.P.invincible ?? 0) < 0.25) G.P.invincible = 0.25;
    },
  },
  {
    id: "bulwark",
    name: "Emergency Shield",
    cooldown: 30,
    capCost: 50,
    duration: 2,
    description: "Brief invincibility shield.",
    onActivate: () => {
      G.P.invincible = Math.max(G.P.invincible ?? 0, 2);
    },
  },
];

export const ABILITY_BY_ID: Record<string, AbilityDef> = Object.fromEntries(
  ABILITIES.map(a => [a.id, a]),
);

interface AbilityState {
  cd: number;
  remaining: number;
}

const _state = new Map<string, AbilityState>();
for (const a of ABILITIES) _state.set(a.id, { cd: 0, remaining: 0 });

export function getAbilityState(id: string): { cd: number; remaining: number } {
  return _state.get(id) ?? { cd: 0, remaining: 0 };
}

export function isAbilityActive(id: string): boolean {
  return (_state.get(id)?.remaining ?? 0) > 0;
}

/** Combined movement multipliers across all currently-active abilities. */
export function activeMovementMultipliers(): { thrust: number; speed: number } {
  let thrust = 1, speed = 1;
  for (const a of ABILITIES) {
    const s = _state.get(a.id);
    if (!s || s.remaining <= 0) continue;
    if (a.thrustMult) thrust *= a.thrustMult;
    if (a.speedMult) speed *= a.speedMult;
  }
  return { thrust, speed };
}

export type ActivateResult = "fired" | "cooldown" | "no-cap" | "aborted" | "missing";

export function tryActivate(id: string): ActivateResult {
  const def = ABILITY_BY_ID[id];
  if (!def) return "missing";
  if (!G.P || G.P.hp <= 0) return "aborted";
  const s = _state.get(id)!;
  if (s.cd > 0) return "cooldown";
  if ((G.P.energy ?? 0) < def.capCost) return "no-cap";

  if (def.onActivate) {
    const ok = def.onActivate();
    if (ok === false) return "aborted";
  }

  G.P.energy = Math.max(0, G.P.energy - def.capCost);
  s.cd = def.cooldown;
  s.remaining = def.duration;
  return "fired";
}

export function tickAbilities(dt: number) {
  for (const s of _state.values()) {
    if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    if (s.remaining > 0) s.remaining = Math.max(0, s.remaining - dt);
  }
}

export function resetAbilities() {
  for (const s of _state.values()) { s.cd = 0; s.remaining = 0; }
}
