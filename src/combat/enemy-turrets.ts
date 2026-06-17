/**
 * Enemy ship turret firing logic.
 */
import { getState, WorldAccess } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { C } from "../config/index.js";
import type { Enemy } from "../types/enemy.js";
import type { Player } from "../state.js";
import { computeLinearInterceptAngle } from "../physics/npc-ai.js";
import { computeEnemyAimDeviation } from "./aim.js";
import { damageEnemy } from "./damage-enemy.js";
import { damagePlayer } from "./damage-display.js";
import { getEnemyTurretOrigin } from "./turret-origin.js";
import { addEnemyBullet, addBeam } from "../utils/entities.js";
import { spawnMuzzleFlash } from "../utils/fx.js";

export function fireTurretsAt(e: Enemy, target: Enemy | Player, dt: number, detectionRange: number) {
  if (!e.fitting?.turret) return;
  const isTargetPlayer = target === getState().player;
  const targetX = target.x;
  const targetY = target.y;
  const targetVx = target.vx || 0;
  const targetVy = target.vy || 0;
  const d = Math.hypot(targetX - e.x, targetY - e.y);
  const origin = getEnemyTurretOrigin(e);
  const fireDist = Math.hypot(targetX - origin.x, targetY - origin.y);

  for (let i = 0; i < e.fitting.turret.length; i++) {
    const uid = e.fitting.turret[i];
    if (!uid) continue;
    const inst = e.fitting._tempInstances?.find((inst) => inst.uid === uid);
    const baseId = inst ? inst.baseId : uid;
    if (e.turretCds[i] > 0) e.turretCds[i] -= dt;

    if (e.turretCds[i] <= 0) {
      const wProf = WEAPON_PROFILES[baseId] || WEAPON_PROFILES.default;
      if (fireDist < Math.min(wProf.range, detectionRange)) {
        const predictedTargetAngle = wProf.type === "beam"
          ? Math.atan2(targetY - origin.y, targetX - origin.x)
          : computeLinearInterceptAngle(
            origin.x,
            origin.y,
            targetX,
            targetY,
            targetVx,
            targetVy,
            wProf.spd || C.ENEMIES.PROJECTILE_SPEED,
            e.accuracy ?? 1.0,
          );
        const shootAng = predictedTargetAngle + computeEnemyAimDeviation(e, fireDist);
        spawnMuzzleFlash(origin.x, origin.y, shootAng, wProf.color, wProf.type === "beam" ? 3 : 4);
        if (wProf.type === "beam") {
          const beamDist = fireDist;
          const bX2 = origin.x + Math.cos(shootAng) * beamDist;
          const bY2 = origin.y + Math.sin(shootAng) * beamDist;
          WorldAccess.queueEffect({
            type: "weaponFire",
            payload: { delivery: "beam", typeId: baseId, vol: 0.7, x: origin.x, y: origin.y },
          });
          addBeam({ x1: origin.x, y1: origin.y, x2: bX2, y2: bY2, color: wProf.color, width: wProf.sz, life: C.ENEMIES.AI.BEAM_IMPACT_LIFE });

          if (isTargetPlayer) {
            const hitR = SHIPS[getState().player.shipId]?.signatureRadius ?? 20;
            const perp = Math.abs((getState().player.x - origin.x) * Math.sin(shootAng) - (getState().player.y - origin.y) * Math.cos(shootAng));
            if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) {
              damagePlayer(Math.max(1, Math.floor(wProf.dmg * (e.weaponMult ?? 1.0))), origin.x, origin.y);
              WorldAccess.queueEffect({
                type: "impact",
                payload: { x: bX2, y: bY2, color: wProf.color, delivery: "beam" },
              });
            }
          } else {
            const hitR = (target as Enemy).sigRadius ?? 20;
            const perp = Math.abs((target.x - origin.x) * Math.sin(shootAng) - (target.y - origin.y) * Math.cos(shootAng));
            if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) {
              damageEnemy(target as Enemy, Math.max(1, Math.floor(wProf.dmg * (e.weaponMult ?? 1.0))), bX2, bY2, undefined, "beam");
              WorldAccess.queueEffect({
                type: "impact",
                payload: { x: bX2, y: bY2, color: wProf.color, delivery: "beam" },
              });
            }
          }
        } else {
          if (getState().enemyBullets.length < 200) {
            const bSpd = wProf.spd || 800;
            const bLife = (wProf.range * 1.1) / bSpd;
            WorldAccess.queueEffect({
              type: "weaponFire",
              payload: { delivery: "projectile", typeId: baseId, vol: 0.8, x: origin.x, y: origin.y },
            });
            addEnemyBullet({
              x: origin.x, y: origin.y, px: origin.x, py: origin.y,
              vx: Math.cos(shootAng) * bSpd, vy: Math.sin(shootAng) * bSpd,
              life: bLife, dmg: wProf.dmg * (e.weaponMult ?? 1.0), color: wProf.color, sz: wProf.sz, trail: wProf.trail,
              ownerFaction: e.faction, ownerId: e.id
            });
          }
        }
        e.turretCds[i] = wProf.rate + (Math.random() * C.ENEMIES.AI.TURRET_RELOAD_JITTER);
      }
    }
  }
}
