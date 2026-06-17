import { C } from "../config/index.js";
import type { DamageProfile } from "../data/modules.js";
import type { ResistProfile } from "../types/enemy.js";

/** Normalize a damage-type split to fractions summing to 1, or null if untyped. */
export function normalizeProfile(p?: DamageProfile | null): ResistProfile | null {
  if (!p) return null;
  const em = p.em ?? 0, therm = p.therm ?? 0, kin = p.kin ?? 0, exp = p.exp ?? 0;
  const sum = em + therm + kin + exp;
  if (sum <= 0) return null;
  return { em: em / sum, therm: therm / sum, kin: kin / sum, exp: exp / sum };
}

/**
 * Mitigate raw damage by a target's per-type resists. Untyped damage (no profile)
 * or a target without resists passes through unmitigated.
 */
export function applyResists(dmg: number, profile?: DamageProfile | null, resists?: ResistProfile): number {
  const frac = normalizeProfile(profile);
  if (!frac || !resists) return dmg;
  const clamp = (r: number) => Math.min(C.COMBAT.RESISTS.max, Math.max(C.COMBAT.RESISTS.min, r));
  const mult = frac.em * (1 - clamp(resists.em)) + frac.therm * (1 - clamp(resists.therm))
             + frac.kin * (1 - clamp(resists.kin)) + frac.exp * (1 - clamp(resists.exp));
  return dmg * mult;
}
