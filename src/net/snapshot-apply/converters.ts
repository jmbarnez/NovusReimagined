import type { DamageProfile, WeaponDelivery } from "../../data/modules.js";
import type { EntitySnapshot } from "../../sim/snapshot.js";
import type { SalvagePickup } from "../../types/system.js";

export function toWeaponDelivery(kind: EntitySnapshot["kind"]): WeaponDelivery | null {
  return kind === "projectile" || kind === "beam" || kind === "missile" ? kind : null;
}

export function toDamageProfile(profile: EntitySnapshot["dmgProfile"]): DamageProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  return profile as DamageProfile;
}

export function toSalvageKind(kind: EntitySnapshot["kind"]): SalvagePickup["kind"] {
  if (kind === "loot" || kind === "module" || kind === "ore" || kind === "credits") return kind;
  return "loot";
}

export function cloneArrayRecord<T>(record: Record<string, T[]>): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const key of Object.keys(record)) {
    out[key] = [...record[key]];
  }
  return out;
}

export function booleanArrayRecordsEqual(a: Record<string, boolean[]> | undefined, b: Record<string, boolean[]>): boolean {
  if (!a) return Object.keys(b).length === 0;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of bKeys) {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < right.length; i++) {
      if (left[i] !== right[i]) return false;
    }
  }
  return true;
}
