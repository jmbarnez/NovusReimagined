import type { Player } from "../state.js";
import { applyResists } from "./resists.js";
import { applyHitGlow, spawnHitImpactVisuals, type HitImpactLayer } from "./hit-impact.js";
import { killEnemy } from "./kill-rewards.js";
import type { DamageProfile } from "../data/modules.js";
import type { WeaponDelivery } from "../data/skills.js";
import type { BulletOwner } from "../utils/entities.js";
import type { Enemy } from "../types/world.js";
import { isPlayerRef } from "../physics/npc-ai.js";

export function damageEnemy(
  e: Enemy,
  dmg: number,
  px: number,
  py: number,
  owner?: BulletOwner,
  weaponKind?: WeaponDelivery | string | null,
  dmgProfile?: DamageProfile | null,
  opts: { contactFlash?: boolean } = {},
) {
  if (dmg <= 0) return;

  const mitigated = applyResists(dmg, dmgProfile, e.resists);
  if (mitigated <= 0) return;

  let displayType: HitImpactLayer = "hull";
  let overflow = mitigated;

  if (e.shield !== undefined && e.shield > 0) {
    displayType = "shield";
    applyHitGlow(e, "shield", px, py);
    if (overflow >= e.shield) {
      overflow -= e.shield;
      e.shield = 0;
    } else {
      e.shield -= overflow;
      overflow = 0;
    }
  }

  if (overflow > 0) {
    displayType = "hull";
    applyHitGlow(e, "hull", px, py);
    if (overflow >= e.hp) {
      overflow -= e.hp;
      e.hp = 0;
    } else {
      e.hp -= overflow;
      overflow = 0;
    }
  }

  if (overflow > 0 && (e.maxStructure ?? 0) > 0) {
    displayType = "structure";
    applyHitGlow(e, "structure", px, py);
    e.structure = (e.structure ?? 0) - overflow;
    if (e.structure < 0) e.structure = 0;
  }

  const isOwnerPlayer = !!owner && isPlayerRef(owner);
  if (isOwnerPlayer) {
    e._lastPlayerHitAt = performance.now();
    e._lastHitByPlayer = owner as Player;
    if (weaponKind === "projectile" || weaponKind === "beam" || weaponKind === "missile") {
      e._lastPlayerHitKind = weaponKind;
    }
  }

  spawnHitImpactVisuals({
    labelX: e.x,
    labelY: e.y - 14,
    impactX: px || e.x,
    impactY: py || e.y,
    amount: Math.max(1, Math.round(mitigated)),
    layer: displayType,
    contactFlash: opts.contactFlash ?? true,
  });
  if (e.hp <= 0 && (e.structure ?? 0) <= 0) killEnemy(e);
}
