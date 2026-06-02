import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import type { Asteroid, Enemy, WreckPiece } from "../types/world.js";
import type { Player } from "../state.js";
import { sortedCompositionEntries } from "../utils/ore-naming.js";
import { ORE } from "../data/resources.js";

export function isWreckPieceTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("piece-");
}

export function isAsteroidTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("ast-");
}

export function targetByLockId(id: string, p: Player = getState().player): Enemy | Asteroid | WreckPiece | null {
  const sys = curSys(p);
  if (!sys) return null;
  let en = sys._enemyMap?.get(id);
  if (!en) {
    en = sys.enemies.find((e) => e.id === id);
    if (en) {
      if (!sys._enemyMap) sys._enemyMap = new Map();
      sys._enemyMap.set(id, en);
    }
  }
  if (en && en.alive) return en;
  let ast = sys._asteroidMap?.get(id);
  if (!ast && isAsteroidTarget(id)) {
    ast = sys.asteroids.find((a) => a.id === id);
    if (ast) {
      if (!sys._asteroidMap) sys._asteroidMap = new Map();
      sys._asteroidMap.set(id, ast);
    }
  }
  if (ast && !ast.depleted && ast.hp > 0) {
    if (!ast.name) {
      const top = sortedCompositionEntries(ast.composition)[0]?.[0] ?? "iron";
      ast.name = `${ORE[top]?.label.split(" ")[0] ?? top} Asteroid`;
    }
    return ast;
  }
  if (isWreckPieceTarget(id)) {
    const wreck = getState().wreckPieces.find((w) => w.id === id);
    return wreck && wreck.hp > 0 ? wreck : null;
  }
  return null;
}

export function enemyByLockId(id: string): Enemy | null {
  const sys = curSys();
  if (!sys) return null;
  const en = sys._enemyMap?.get(id);
  return en && en.alive ? en : null;
}
