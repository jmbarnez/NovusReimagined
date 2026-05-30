import { random } from "../utils/math.js";
import type { Player } from "../state.js";
import { aimAngle } from "../utils/math.js";
import { computeLinearInterceptAngle } from "../physics/npc-ai.js";
import { C } from "../config/index.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Enemy, Asteroid, WreckPiece } from "../types/world.js";

export function aimDeviationCone(baseScatter: number, distScatter: number, capRad: number, dist: number, accuracy: number): number {
  const totalScatter = (baseScatter + distScatter) / Math.max(0.1, accuracy);
  const coneHalf = Math.min(capRad, totalScatter / Math.max(1, dist));
  const u = random() - random();
  return u * coneHalf;
}

export function computeEnemyAimDeviation(enemy: Enemy, dist: number): number {
  const accuracy = enemy.accuracy ?? 1.0;
  const baseScatter = C.COMBAT.ENEMY_AIM.baseScatter / Math.max(C.COMBAT.ENEMY_AIM.accuracyFloor, accuracy);
  const distRatio = Math.min(dist / C.COMBAT.ENEMY_AIM.distanceReference, C.COMBAT.ENEMY_AIM.distanceRatioCap);
  const distScatter = distRatio * distRatio * C.COMBAT.ENEMY_AIM.distanceScatterBase;
  return aimDeviationCone(baseScatter, distScatter, C.COMBAT.ENEMY_AIM.deviationCapRad, dist, accuracy);
}

export function calculatePredictiveAimAngle(
  actualTarget: Enemy | Asteroid | WreckPiece | null,
  wProf: WeaponProfile,
  p: Player,
): number {
  if (!actualTarget) {
    const mouse = p.inputMouseWorld ?? { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200 };
    return aimAngle(p.x, p.y, mouse.x, mouse.y);
  }

  const tvx = (actualTarget as Enemy).vx || 0;
  const tvy = (actualTarget as Enemy).vy || 0;

  // Beams are instant; slow movers use direct aim.
  const projectileSpeed = wProf.type === "missile"
    ? C.COMBAT.MISSILE.cruiseSpeed
    : wProf.spd;
  if (projectileSpeed <= 0) {
    return Math.atan2(actualTarget.y - p.y, actualTarget.x - p.x);
  }

  return computeLinearInterceptAngle(
    p.x,
    p.y,
    actualTarget.x,
    actualTarget.y,
    tvx,
    tvy,
    projectileSpeed,
    1.0,
    C.ENEMIES.AI.PREDICTION_TIME_CAP,
  );
}
