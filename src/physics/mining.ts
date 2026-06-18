import { random, rayCircleSurfaceHit } from "../utils/math.js";
import { Client, isGameplayPaused, type Player } from "../state.js";
import { MiningAccess, PlayerAccess, getState, WorldAccess } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { spawnMiningSparks } from "../utils/fx.js";
import { getAsteroidColRadius } from "../utils/asteroid-helpers.js";
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

let _miningHumTimer = 0;
let _miningSparkTimer = 0;

/** Find the nearest non-depleted asteroid within tolerance of the given point. */
function findAsteroidAtCursor(sys: ReturnType<typeof getState>["GALAXY"][number] | undefined, wx: number, wy: number, tolerance: number) {
  if (!sys) return null;
  let best: { ast: typeof sys.asteroids[number]; dist: number } | null = null;
  for (const ast of sys.asteroids) {
    if (ast.depleted || ast.hp <= 0) continue;
    const dist = Math.hypot(ast.x - wx, ast.y - wy);
    if (dist <= ast.radius + tolerance && (!best || dist < best.dist)) {
      best = { ast, dist };
    }
  }
  return best?.ast ?? null;
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

    // Find asteroid near the cursor (generous tolerance for feel)
    const ast = findAsteroidAtCursor(sys, targetX, targetY, 40);

    const energyCost = 10 * dt;
    if (p.energy < energyCost) {
      MiningAccess.update({ active: false }, p);
      return;
    }
    PlayerAccess.setEnergy(p.energy - energyCost, p);

    if (ast) {
      const astColR = getAsteroidColRadius(ast);
      const surface = rayCircleSurfaceHit(origin.x, origin.y, ast.x, ast.y, astColR);
      MiningAccess.update({
        active: true,
        x1: origin.x,
        y1: origin.y,
        x2: surface.x,
        y2: surface.y,
        hitR: astColR,
        hitNx: surface.nx,
        hitNy: surface.ny,
        phase: (p.miningLaser?.phase || 0) + dt * 18,
      }, p);
      beamSet = true;

      if (p === getState().player) {
        _miningHumTimer -= dt;
        if (_miningHumTimer <= 0) {
          WorldAccess.queueEffect({
            type: "industrialBeam",
            payload: { delivery: "mining", x: surface.x, y: surface.y },
          });
          _miningHumTimer = 0.5;
        }
        _miningSparkTimer -= dt;
        if (_miningSparkTimer <= 0) {
          _miningSparkTimer = 0.11 + random() * 0.07;
          const sparkColor = p.miningLaser?.oreColor || "#c8a060";
          spawnMiningSparks(surface.x, surface.y, surface.nx, surface.ny, sparkColor, 1.0);
        }
      }

      if (p.mineCd > 0) {
        PlayerAccess.setMineCd(p.mineCd - dt, p);
        return;
      }

      const result = harvestAsteroid(ast, st.miningMult);
      if (result.dmg > 0) {
        showDamageNumber(surface.x, surface.y, Math.round(result.dmg), "mining");
      }
      if (p === getState().player) {
        WorldAccess.queueEffect({
          type: "impact",
          payload: { x: surface.x, y: surface.y, color: "#ff8822", delivery: "mining" },
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
        spawnMiningSparks(surface.x, surface.y, surface.nx, surface.ny, oreColor, 1.4);
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
