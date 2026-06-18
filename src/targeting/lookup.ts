import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import type { Asteroid } from "../types/asteroid.js";
import type { Enemy } from "../types/enemy.js";
import type { WreckPiece } from "../types/system.js";
import type { AutoTarget } from "../types/combat.js";
import type { Player } from "../state.js";

import { gateByLockId, gateLockTarget, isGateLockId } from "../utils/warp-gates.js";

export function isWreckPieceTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("piece-");
}

export function isAsteroidTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("ast-");
}

export function targetByLockId(id: string, p: Player = getState().player): Enemy | Asteroid | WreckPiece | AutoTarget | null {
  const sys = curSys(p);
  if (!sys) return null;
  let en = sys.enemyMap?.get(id);
  if (!en) {
    en = sys.enemies.find((e) => e.id === id);
    if (en) {
      if (!sys.enemyMap) sys.enemyMap = new Map();
      sys.enemyMap.set(id, en);
    }
  }
  if (en && en.alive) return en;
  let ast = sys.asteroidMap?.get(id);
  if (!ast && isAsteroidTarget(id)) {
    ast = sys.asteroids.find((a) => a.id === id);
    if (ast) {
      if (!sys.asteroidMap) sys.asteroidMap = new Map();
      sys.asteroidMap.set(id, ast);
    }
  }
  if (ast && !ast.depleted && ast.hp > 0) {
    if (!ast.name) {
      ast.name = "Asteroid";
    }
    return ast;
  }
  if (isWreckPieceTarget(id)) {
    const wreck = getState().wreckPieces.find((w) => w.id === id);
    return wreck && wreck.hp > 0 ? wreck : null;
  }
  if (isGateLockId(id)) {
    const gate = gateByLockId(id);
    return gate ? gateLockTarget(gate, getState().GALAXY) : null;
  }
  return null;
}

export function enemyByLockId(id: string): Enemy | null {
  const sys = curSys();
  if (!sys) return null;
  const en = sys.enemyMap?.get(id);
  return en && en.alive ? en : null;
}
