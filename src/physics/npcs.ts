import { getState } from "../state-access.js";
import {
  updateAsteroids as updateAsteroidsForSys,
  updateEnemyBullets as updateEnemyBulletsForSys,
  updateEnemyRespawns as updateEnemyRespawnsForSys,
  updateNpcs as updateNpcsForSys,
} from "./npcs/index.js";
import { updateMining as updateMiningForPlayer } from "./mining.js";

function currentSysIdx(): number {
  return getState().player?.sysIdx ?? 0;
}

export function updateNpcs(dt: number): void {
  updateNpcsForSys(dt, currentSysIdx(), getState().player ?? null);
}

export function updateEnemyBullets(dt: number): void {
  updateEnemyBulletsForSys(dt, currentSysIdx());
}

export function updateAsteroids(dt: number): void {
  updateAsteroidsForSys(dt, currentSysIdx());
}

export function updateMining(dt: number): void {
  const p = getState().player;
  if (!p) return;
  updateMiningForPlayer(dt, p);
}

export function updateEnemyRespawns(dt: number): void {
  updateEnemyRespawnsForSys(dt, currentSysIdx());
}
