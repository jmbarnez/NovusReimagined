import type { Player } from "../state.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { PlayerAccess, WorldAccess } from "../state-access.js";
import { dst, random, angleDiff } from "../utils/math.js";
import { ensureAmmoDefaults } from "../player/player-data.js";
import { getStats, getWeaponProfileForSlot, weaponSkillBonus } from "../player/player-stats.js";
import { WEAPON_SKILL, levelForSkillXp, type WeaponDelivery } from "../data/skills.js";
import { C } from "../config/index.js";
import { floatText, spawnMuzzleFlash } from "../utils/fx.js";
import { addBullet, isTargetDestroyed } from "../utils/entities.js";
import { isAsteroidTarget, transversalVs } from "../targeting/lookup.js";
import { MODULES, MODULE_FLAGS, type ModuleDef } from "../data/modules.js";
import { getPlayerTurretOrigin } from "./turret-origin.js";
import { flashSlotFire, logEvent } from "../feedback.js";
import { t } from "../utils/i18n.js";
import { aimDeviationCone, calculatePredictiveAimAngle } from "./aim.js";
import { computeHitQuality } from "./hit-quality.js";
import { fireBeamWeapon } from "./beam-weapon.js";
import { fireMissile } from "./missile.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Enemy } from "../types/enemy.js";
import type { Asteroid } from "../types/asteroid.js";
import type { WreckPiece } from "../types/system.js";

let _lastNotInArcWarn = 0;
const NOT_INARC_COOLDOWN_MS = 800;

function validatePlayerShootRequirements(
  p: Player,
  slotIdx: number,
): { uid: string; inst: ModuleInstance; turretMod: ModuleDef; wProf: WeaponProfile; capNeed: number; ammoKey: string; ammoCost: number } | null {
  const hpRack = playerHardpointRack(p);
  const uid = p.fitting?.[hpRack]?.[slotIdx];
  if (!uid) return null;
  const inst = p.moduleCargo.find((item: ModuleInstance) => item.uid === uid);
  if (!inst) return null;
  if (inst.durability <= 0) return null;
  const turretMod = MODULES[inst.baseId];
  if (!turretMod) return null;
  if (MODULE_FLAGS.isMiningTurret(turretMod)) return null;

  const wProf = getWeaponProfileForSlot(slotIdx, p);
  if (!wProf) return null;

  if ((p.turretCds?.[slotIdx] || 0) > 0) return null;

  const capNeed = wProf.ec + C.COMBAT.CAP_FIRE_SURCHARGE;
  if (p.energy < capNeed) return null;

  const ammoKey = wProf.ammoType || "hybrid";
  const ammoCost = wProf.ammoPerShot ?? 1;
  if (ammoCost > 0 && (p.ammo[ammoKey as keyof typeof p.ammo] ?? 0) < ammoCost) {
    if (typeof window !== "undefined") {
      floatText(p.x, p.y - 22, t("combat.noAmmo"), "#ff9944");
      logEvent(t("combat.noAmmoLog"), "warn");
    }
    return null;
  }

  return { uid, inst, turretMod, wProf, capNeed, ammoKey, ammoCost };
}

export function playerShoot(slotIdx: number, targetEnemy: Enemy | Asteroid | WreckPiece | null, p: Player): boolean {
  ensureAmmoDefaults(p);
  const reqs = validatePlayerShootRequirements(p, slotIdx);
  if (!reqs) return false;

  const { turretMod, wProf, capNeed, ammoKey, ammoCost } = reqs;
  const st = getStats(p);

  let actualTarget = targetEnemy;
  if (actualTarget && isTargetDestroyed(actualTarget)) actualTarget = null;

  const delivery = (turretMod.weaponDelivery ?? "projectile") as WeaponDelivery;

  const tracked = delivery !== "missile" && !!actualTarget && !isAsteroidTarget(actualTarget.id);
  const quality = tracked ? computeHitQuality(actualTarget as Enemy, turretMod, wProf, p) : 1;
  const isMiss = tracked && quality < C.COMBAT.RANGE_MODEL.missThreshold;

  let angle = calculatePredictiveAimAngle(actualTarget, wProf, p);

  if (delivery !== "missile" && actualTarget && !isAsteroidTarget(actualTarget.id)) {
    const skillId = WEAPON_SKILL[delivery];
    const lvl = levelForSkillXp(p.skillXp?.[skillId] || 0);
    const playerAccuracy = C.COMBAT.PLAYER_AIM.skillBase + lvl * C.COMBAT.PLAYER_AIM.skillPerWeaponLevel;

    const dist = Math.max(1, dst(p.x, p.y, actualTarget.x, actualTarget.y));
    const transversal = transversalVs(actualTarget as Enemy, p);

    const distRatio = Math.min(dist / 600, C.COMBAT.PLAYER_AIM.distanceRatioCap);
    const distScatter = distRatio * distRatio * C.COMBAT.PLAYER_AIM.distanceScatterBase;

    const trk = turretMod.trackingSpeed ?? C.PLAYER.TURRET.defaultTrackingSpeed;
    const sig = (actualTarget as Enemy).sigRadius || C.COMBAT.RANGE_MODEL.defaultSig;

    const trackingShortfall = Math.max(0, (transversal / dist) - trk);
    const transversalScatter = Math.min(C.COMBAT.PLAYER_AIM.transversalCap, trackingShortfall)
      * C.COMBAT.PLAYER_AIM.transversalScatterBase * (C.COMBAT.PLAYER_AIM.sigMultiplier * C.COMBAT.RANGE_MODEL.sigRef / sig);

    const baseScatter = 15;
    const deviation = aimDeviationCone(
      baseScatter,
      distScatter + transversalScatter,
      C.COMBAT.PLAYER_AIM.deviationCapRad,
      dist,
      playerAccuracy,
    );
    angle += deviation;
  }

  if (isMiss) {
    const skew = (random() > 0.5 ? 1 : -1) * (0.12 + random() * 0.13);
    angle += skew;
  }

  const traverseDiff = Math.abs(angleDiff(p.angle, angle));
  if (traverseDiff > C.COMBAT.TURRET.traverseConeRad) {
    if (typeof window !== "undefined") {
      const now = performance.now();
      if (now - _lastNotInArcWarn > NOT_INARC_COOLDOWN_MS) {
        _lastNotInArcWarn = now;
        floatText(p.x, p.y - 22, t("combat.notInArc"), "#ff9944");
      }
    }
    return false;
  }

  PlayerAccess.setTurretCd(slotIdx, wProf.rate, p);
  PlayerAccess.setEnergy(p.energy - capNeed, p);
  if (ammoKey !== "none") {
    PlayerAccess.setAmmo(ammoKey as "hybrid" | "missile", p.ammo[ammoKey as keyof typeof p.ammo] - ammoCost, p);
  }

  flashSlotFire(slotIdx);

  const origin = getPlayerTurretOrigin(p);
  const muzzleIntensity = turretMod.weaponDelivery === "missile" ? C.COMBAT.MUZZLE_FLASH.missileIntensity : turretMod.weaponDelivery === "projectile" && wProf.dmg >= C.COMBAT.MUZZLE_FLASH.heavyProjectileDmgThreshold ? C.COMBAT.MUZZLE_FLASH.heavyProjectileIntensity : C.COMBAT.MUZZLE_FLASH.defaultIntensity;

  spawnMuzzleFlash(origin.x, origin.y, angle, wProf.color, muzzleIntensity);
  WorldAccess.queueEffect({
    type: "weaponFire",
    payload: {
      delivery: turretMod.weaponDelivery!,
      typeId: turretMod.id,
      vol: 1,
      x: origin.x,
      y: origin.y,
    },
  });

  const weaponMult = st.weaponMult * (1 + weaponSkillBonus(delivery, p));
  const dmgProfile = turretMod.damageProfile ?? null;
  const baseDmg = wProf.dmg * weaponMult;

  const jitterMin = C.COMBAT.RANGE_MODEL.jitterMin;
  const jitterMax = 2 - jitterMin;
  const jitter = jitterMin + random() * (jitterMax - jitterMin);
  const qualityDmg = Math.max(1, Math.round(baseDmg * quality * jitter));

  const ox = origin.x, oy = origin.y;

  if (wProf.type === "beam") {
    fireBeamWeapon(ox, oy, angle, wProf, qualityDmg, delivery, p, dmgProfile);
  } else if (delivery === "missile") {
    fireMissile(ox, oy, angle, wProf, qualityDmg, turretMod, actualTarget, slotIdx, p);
  } else {
    addBullet({
      x: ox, y: oy, px: ox, py: oy,
      vx: Math.cos(angle) * wProf.spd,
      vy: Math.sin(angle) * wProf.spd,
      life: wProf.range / wProf.spd,
      dmg: qualityDmg,
      color: wProf.color, sz: wProf.sz, trail: wProf.trail,
      owner: p,
      kind: turretMod.weaponDelivery ?? null,
      weaponId: turretMod.id,
      dmgProfile: dmgProfile ?? undefined,
    });
  }
  return true;
}
