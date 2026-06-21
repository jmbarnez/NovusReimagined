import { random } from "../utils/math.js";
import { Client, isGameplayPaused, type Player } from "../state.js";
import { MiningAccess, PlayerAccess, getState, WorldAccess } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { spawnCollisionFx } from "../utils/fx.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import {
  forEachFittedModuleSlot,
  isModuleSlotPowered,
  type ModuleSlotRef,
} from "../utils/module-slots.js";
import { ORE } from "../data/resources.js";
import { damagePlayer, showDamageNumber } from "../combat/damage-display.js";
import { getPlayerTurretOrigin } from "../combat/turret-origin.js";
import { getPlayerInput } from "../player/input-state.js";
import { harvestAsteroid, destroyAsteroid } from "../utils/mining.js";
import { isPointInAsteroid, asteroidSegmentPolygonHit } from "./combat-physics.js";
import type { Asteroid } from "../types/asteroid.js";

let _miningHumTimer = 0;
let _miningSparkTimer = 0;

/** Find the non-depleted asteroid whose polygon contains the given world point. */
function findAsteroidAtPoint(sys: ReturnType<typeof getState>["GALAXY"][number] | undefined, wx: number, wy: number): Asteroid | null {
  if (!sys) return null;
  for (const ast of sys.asteroids) {
    if (ast.depleted || ast.hp <= 0) continue;
    if (isPointInAsteroid(wx, wy, ast, 0)) return ast;
  }
  return null;
}

export function updateMining(dt: number, p: Player) {
  const st = getStats(p);
  if (!st.hasMiner) {
    MiningAccess.update({ active: false }, p);
    return;
  }

  const input = getPlayerInput(p.netId ?? p.shipId);
  const inputKeys = input.keys;
  const inputMouseWorld = input.mouseWorld;

  // Manual fire: LMB must be held
  if (!inputKeys.lmb) {
    MiningAccess.update({ active: false, phase: 0, oreKey: "", oreColor: "" }, p);
    return;
  }

  if (p === getState().player && (isGameplayPaused() || Client.showMap || Client.bridgeOpen)) {
    MiningAccess.update({ active: false }, p);
    return;
  }

  const sys = getState().GALAXY[p.sysIdx];
  let beamSet = false;

  const processMiner = (ref: ModuleSlotRef, m: typeof MODULES[string]) => {
    if (beamSet) return;
    if (!isModuleSlotPowered(ref.rack, ref.idx, p)) return;

    const origin = getPlayerTurretOrigin(p);
    const maxRange = m.optimalRange != null ? m.optimalRange : st.mineRange;

    // Target cursor position, clamped to max range
    let targetX = inputMouseWorld.x;
    let targetY = inputMouseWorld.y;
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const cursorDist = Math.hypot(dx, dy);
    if (cursorDist > maxRange) {
      const scale = maxRange / cursorDist;
      targetX = origin.x + dx * scale;
      targetY = origin.y + dy * scale;
    }

    // Find asteroid whose polygon contains the cursor (no auto-lock snap)
    const ast = findAsteroidAtPoint(sys, targetX, targetY);

    const energyCost = 10 * dt;
    if (p.energy < energyCost) {
      MiningAccess.update({ active: false }, p);
      return;
    }
    PlayerAccess.setEnergy(p.energy - energyCost, p);

    if (ast) {
      // Precise polygon surface hit — beam stops exactly at the asteroid edge
      const hit = asteroidSegmentPolygonHit(origin.x, origin.y, targetX, targetY, ast, 0);
      let surfaceX: number, surfaceY: number, hitNx: number, hitNy: number;
      if (hit) {
        surfaceX = hit.x;
        surfaceY = hit.y;
      } else {
        // Cursor is inside the asteroid but origin is too — use cursor as fallback
        surfaceX = targetX;
        surfaceY = targetY;
      }
      // Surface normal = outward direction from asteroid centre to hit point
      const ndx = surfaceX - ast.x;
      const ndy = surfaceY - ast.y;
      const nlen = Math.hypot(ndx, ndy) || 1;
      hitNx = ndx / nlen;
      hitNy = ndy / nlen;

      MiningAccess.update({
        active: true,
        x1: origin.x,
        y1: origin.y,
        x2: surfaceX,
        y2: surfaceY,
        hitR: ast.radius,
        hitNx,
        hitNy,
        phase: (p.miningLaser?.phase || 0) + dt * 18,
      }, p);
      beamSet = true;

      if (p === getState().player) {
        _miningHumTimer -= dt;
        if (_miningHumTimer <= 0) {
          WorldAccess.queueEffect({
            type: "industrialBeam",
            payload: { delivery: "mining", x: surfaceX, y: surfaceY },
          });
          _miningHumTimer = 0.5;
        }
        _miningSparkTimer -= dt;
        if (_miningSparkTimer <= 0) {
          _miningSparkTimer = 0.11 + random() * 0.07;
          const sparkColor = p.miningLaser?.oreColor || "#c8a060";
          spawnCollisionFx({ x: surfaceX, y: surfaceY, nx: hitNx, ny: hitNy, intensity: 40, material: "ore", tint: sparkColor });
        }
      }

      if (p.mineCd > 0) {
        PlayerAccess.setMineCd(p.mineCd - dt, p);
        return;
      }

      const result = harvestAsteroid(ast, st.miningMult);
      if (result.dmg > 0) {
        showDamageNumber(surfaceX, surfaceY, Math.round(result.dmg), "mining");
      }
      if (p === getState().player) {
        WorldAccess.queueEffect({
          type: "impact",
          payload: { x: surfaceX, y: surfaceY, color: "#ff8822", delivery: "mining" },
        });
      }
      PlayerAccess.setMineCd(0.45, p);
      if (result.oreKey) {
        MiningAccess.update({
          oreKey: result.oreKey,
          oreColor: (ORE[result.oreKey] ?? ORE.iron).color,
        }, p);
      }
      if (p === getState().player) {
        const oreColor = p.miningLaser?.oreColor || "#a0a5aa";
        spawnCollisionFx({ x: surfaceX, y: surfaceY, nx: hitNx, ny: hitNy, intensity: 56, material: "ore", tint: oreColor });
      }
      if (!result.depleted) return;

      MiningAccess.update({ hitR: 0, active: false }, p);
      ast.respawnTimer = 60 + random() * 60;
      destroyAsteroid(ast, true, st.miningMult, p);
    } else {
      // Beam to empty space (cursor beyond asteroid or no target)
      MiningAccess.update({
        active: true,
        x1: origin.x,
        y1: origin.y,
        x2: targetX,
        y2: targetY,
        hitR: 0,
        hitNx: 0,
        hitNy: 0,
        phase: (p.miningLaser?.phase || 0) + dt * 18,
      }, p);
      beamSet = true;
      if (p.mineCd > 0) PlayerAccess.setMineCd(p.mineCd - dt, p);
    }
  };

  forEachFittedModuleSlot(MODULE_FLAGS.isMiningTurret, processMiner, p);
  if (!beamSet) {
    MiningAccess.update({ active: false, phase: 0, oreKey: "", oreColor: "" }, p);
  }
}
