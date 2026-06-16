import { type Player } from "../state.js";

export function resetTutorialTrackState(_p: Player): void {
  // No-op: boost gates removed.
}

export function getTutorialGateCooldown(_gateId: string, _p: Player): number {
  return 0;
}

export function getTutorialGatesClearedCount(_trackId: string, _p: Player): number {
  return 0;
}

export function getTutorialGateTotalCount(_trackId: string): number {
  return 0;
}

/** Boost gates removed — kept as no-op for backward compatibility. */
export function updateTutorialTrack(_dt: number, _p: Player, _isReplaying = false): void {
  // No-op.
}
