import { getState } from "../../state-access.js";
import type { WorldSnapshot } from "../../sim/snapshot.js";
import { addBullet, addEnemyBullet } from "../../utils/entities.js";
import { toDamageProfile, toWeaponDelivery } from "./converters.js";

export function applyProjectileSnapshots(snap: WorldSnapshot): void {
  getState().bullets.length = 0;
  getState().enemyBullets.length = 0;

  for (const ent of snap.entities) {
    if (ent.type === "bullet") {
      addBullet({
        id: ent.id as number,
        x: ent.x,
        y: ent.y,
        px: ent.x,
        py: ent.y,
        vx: ent.vx,
        vy: ent.vy,
        life: 1.0,
        dmg: ent.dmg ?? 0,
        color: ent.color ?? "#ffffff",
        sz: ent.sz ?? 2,
        trail: ent.trail ?? null,
        owner: null,
        kind: toWeaponDelivery(ent.kind),
        weaponId: ent.weaponId ?? null,
        hitChance: ent.hitChance ?? 1,
        targetId: ent.targetId ?? null,
        homingTurnRate: ent.homingTurnRate,
        accel: ent.accel,
        maxSpeed: ent.maxSpeed,
        dmgProfile: toDamageProfile(ent.dmgProfile),
      });
    } else if (ent.type === "enemyBullet") {
      addEnemyBullet({
        id: ent.id as number,
        x: ent.x,
        y: ent.y,
        px: ent.x,
        py: ent.y,
        vx: ent.vx,
        vy: ent.vy,
        life: 1.0,
        dmg: ent.dmg ?? 0,
        color: ent.color ?? "#ff4444",
        sz: ent.sz ?? 2,
        trail: ent.trail ?? null,
        ownerFaction: ent.ownerFaction,
        ownerId: ent.ownerId,
        kind: ent.kind ?? null,
      });
    }
  }
}
