import type { Player } from "../state.js";
import type { Asteroid, System } from "../types/world.js";
import { TUTORIAL_SPAWN, shouldRelocateTutorialStart } from "../data/tutorial-layout.js";

export interface SpawnCoords {
  x: number;
  y: number;
  px: number;
  py: number;
}

/** True when the player needs spawn coordinates resolved before sim/handshake. */
export function needsSpawnResolution(player: Player): boolean {
  if (player.pendingHomeSpawn) return true;
  const sysIdx = player.sysIdx || 0;
  if (
    player.tutorial?.active &&
    sysIdx === 0 &&
    player.tutorial.step === 0 &&
    shouldRelocateTutorialStart(player.x, player.y)
  ) {
    return true;
  }
  if (Math.hypot(player.x, player.y) < 1) return true;
  return false;
}

function computeSpawnCoords(sys: System | undefined, sysIdx: number): SpawnCoords {
  const st = sys?.stations?.[0];
  if (st) {
    const len = Math.hypot(st.x, st.y) || 1;
    const nx = len > 0.5 ? st.x / len : 1;
    const ny = len > 0.5 ? st.y / len : 0;
    const pad = st.radius + 240;
    const x = st.x + nx * pad;
    const y = st.y + ny * pad;
    return { x, y, px: x, py: y };
  }

  if (sys?.asteroids?.length) {
    const firstAst = sys.asteroids[0];
    const clusterId = firstAst.id.split("-")[2];
    const cluster = sys.asteroids.filter((a: Asteroid) => a.id.split("-")[2] === clusterId);
    let cx = 0;
    let cy = 0;
    for (const a of cluster) {
      cx += a.x;
      cy += a.y;
    }
    cx /= cluster.length;
    cy /= cluster.length;
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 120 + Math.random() * 80;
    const x = cx + Math.cos(spawnAngle) * spawnDist;
    const y = cy + Math.sin(spawnAngle) * spawnDist;
    return { x, y, px: x, py: y };
  }

  console.warn(`[player-spawn] No spawn anchors in system ${sysIdx}, using TUTORIAL_SPAWN fallback`);
  return { x: TUTORIAL_SPAWN.x, y: TUTORIAL_SPAWN.y, px: TUTORIAL_SPAWN.x, py: TUTORIAL_SPAWN.y };
}

/** Resolve spawn coordinates in-place; never silently defaults to (0, 0). */
export function resolvePlayerSpawn(player: Player, galaxy: System[]): Player {
  if (!needsSpawnResolution(player)) {
    return player;
  }

  player.pendingHomeSpawn = false;
  const sysIdx = player.sysIdx || 0;
  const sys = galaxy[sysIdx];

  if (player.tutorial?.active && sysIdx === 0) {
    if (player.tutorial.step === 0 && shouldRelocateTutorialStart(player.x, player.y)) {
      player.x = TUTORIAL_SPAWN.x;
      player.y = TUTORIAL_SPAWN.y;
      player.px = TUTORIAL_SPAWN.x;
      player.py = TUTORIAL_SPAWN.y;
    }
    return player;
  }

  const coords = computeSpawnCoords(sys, sysIdx);
  player.x = coords.x;
  player.y = coords.y;
  player.px = coords.px;
  player.py = coords.py;
  return player;
}

/** Force spawn near the first station in the given system (e.g. post-tutorial redirect). */
export function spawnNearFirstStation(player: Player, galaxy: System[], sysIdx: number): void {
  const sys = galaxy[sysIdx];
  const st = sys?.stations?.[0];
  if (!st) return;
  const coords = computeSpawnCoords(sys, sysIdx);
  player.x = coords.x;
  player.y = coords.y;
  player.px = coords.px;
  player.py = coords.py;
}

/** Client boot helper — resolves pending home spawn when needed. */
export function setupPlayerSpawn(player: Player, galaxy: System[]): void {
  if (!needsSpawnResolution(player)) return;
  resolvePlayerSpawn(player, galaxy);
}
