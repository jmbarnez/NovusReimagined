import type { EntitySnapshot, PlayerSnapshot } from "./types.js";

export function setPlayerDiff(
  target: Partial<PlayerSnapshot>,
  key: keyof PlayerSnapshot,
  value: PlayerSnapshot[keyof PlayerSnapshot],
): void {
  const writable = target as Record<keyof PlayerSnapshot, PlayerSnapshot[keyof PlayerSnapshot] | undefined>;
  writable[key] = value;
}

export function setEntityDiff(
  target: Partial<EntitySnapshot>,
  key: keyof EntitySnapshot,
  value: EntitySnapshot[keyof EntitySnapshot],
): void {
  const writable = target as Record<keyof EntitySnapshot, EntitySnapshot[keyof EntitySnapshot] | undefined>;
  writable[key] = value;
}

export function quantizeSnapshotNumber(value: number): number {
  return Math.round(value * 100) / 100;
}
