import { addBullet, isTargetDestroyed } from "../utils/entities.js";
import { targetByLockId, isAsteroidTarget } from "../targeting.js";
import { liveEnemies } from "../utils/game.js";
import { C } from "../config/index.js";
import type { ModuleDef } from "../data/modules.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Player } from "../state.js";
import type { Enemy, Asteroid, WreckPiece } from "../types/world.js";

/**
 * Pick the enemy a launched missile should home onto: an explicitly passed
 * target, otherwise the slot's assigned lock, otherwise the primary target
 * lock. Missiles only track live enemies (not asteroids/wrecks); a missile with
 * no valid target dumbfires straight ahead.
 */
function resolveMissileTarget(passed: Enemy | Asteroid | WreckPiece | null, slotIdx: number, p: Player): Enemy | null {
  let t: Enemy | Asteroid | WreckPiece | null =
    passed && !isAsteroidTarget(passed.id) ? passed : null;
  if (!t) {
    const lockId = p.turretTargets?.[slotIdx] || p.targetLock?.id || null;
    if (lockId) t = targetByLockId(lockId, p);
  }
  if (!t || isAsteroidTarget(t.id) || isTargetDestroyed(t)) return null;
  return liveEnemies(p).find((e) => e.id === t!.id) ?? null;
}

export function fireMissile(
  ox: number, oy: number, angle: number, wProf: WeaponProfile,
  finalDmg: number, turretMod: ModuleDef,
  passedTarget: Enemy | Asteroid | WreckPiece | null, slotIdx: number,
  p: Player,
) {
  const M = C.COMBAT.MISSILE;
  const target = resolveMissileTarget(passedTarget, slotIdx, p);
  const life = (wProf.range / M.cruiseSpeed) * M.lifetimeMultiplier;
  addBullet({
    x: ox, y: oy, px: ox, py: oy,
    vx: Math.cos(angle) * M.launchSpeed,
    vy: Math.sin(angle) * M.launchSpeed,
    life,
    dmg: finalDmg,
    color: wProf.color, sz: wProf.sz, trail: wProf.trail,
    owner: p,
    kind: "missile",
    weaponId: turretMod.id,
    hitChance: 1,
    targetId: target?.id ?? null,
    homingTurnRate: M.turnRate,
    accel: M.accel,
    maxSpeed: M.cruiseSpeed,
    dmgProfile: turretMod.damageProfile,
  });
}
