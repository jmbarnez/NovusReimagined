/**
 * Player-vs-solid collision resolution (asteroids, enemies, wreck pieces).
 */
import type { Player } from "../state.js";
import type { Asteroid, Enemy, WreckPiece } from "../types/world.js";
import type { SpatialQueryResult } from "../utils/spatial.js";
import { PlayerAccess, getState } from "../state-access.js";
import {
  PLAYER_MASS, ASTEROID_DENSITY, ENEMY_MASS,
  COLLISION_RESTITUTION, COLLISION_DMG_THRESHOLD,
  COLLISION_DMG_SCALE, COLLISION_COOLDOWN,
} from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { resolveElasticCollision } from "../utils/math.js";
import { SHIPS } from "../data/ships.js";

const _colHits: SpatialQueryResult<unknown>[] = [];

export function resolveSolidCollisions(p: Player) {
  const grid = getState().spatialGrid;
  if (!grid) return;
  const playerR = SHIPS[p.shipId]?.colRadius ?? 20;

  _colHits.length = 0;
  grid.query(p.x, p.y, playerR, null, _colHits);

  for (let i = 0; i < _colHits.length; i++) {
    const h = _colHits[i];
    if (h.type === "player" || h.type === "station") continue;
    if (h.dist < 0.001) continue;

    const overlap = playerR + h.radius - h.dist;
    if (overlap <= 0) continue;

    const nx = h.dx / h.dist;
    const ny = h.dy / h.dist;

    if (h.type === "asteroid") {
      const ast = h.data as Asteroid;
      if (!ast) continue;
      const mA = ast.radius * ast.radius * ASTEROID_DENSITY;
      const closing = resolveElasticCollision(p, ast, PLAYER_MASS, mA, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        damagePlayer(dmg, ast.x, ast.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      const closing = resolveElasticCollision(p, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        damagePlayer(dmg, en.x, en.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      // Piece mass proportional to radius^2 (flat debris slab approximation).
      const pieceMass = piece.radius * piece.radius * 0.8;
      const closing = resolveElasticCollision(p, piece, PLAYER_MASS, pieceMass, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }
    }
  }
}
