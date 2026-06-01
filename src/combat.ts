import { Client, type Player } from "./state.js";
import { getState, PlayerAccess } from "./state-access.js";
import { dst, aimAngle } from "./utils/math.js";
import { ensureAmmoDefaults, addXp, addSkillXp } from "./player/player-data.js";
import { getStats, getWeaponProfileForSlot, weaponSkillBonus } from "./player/player-stats.js";
import { WEAPON_SKILL, type WeaponDelivery } from "./data/skills.js";
import { CAP_FIRE_SURCHARGE, XP_PER_KILL, RESPAWN_S, PLAYER_PARTICIPATION_WINDOW_MS } from "./constants.js";
import { floatText, spawnParticles, spawnBeam, spawnBeamImpactSubtle, spawnImpactFlash, spawnExplosion, spawnMuzzleFlash } from "./utils/fx.js";
import { addBullet, isTargetDestroyed, type BulletOwner } from "./utils/entities.js";
import { clearSensorLocks, syncPrimaryTargetLock, targetByLockId, isAsteroidTarget, transversalVs, removeSensorLock } from "./targeting.js";
import { liveEnemies, curSys } from "./utils/game.js";
import { MODULES, MODULE_FLAGS, type ModuleDef } from "./data/modules.js";
import { SHIPS } from "./data/ships.js";
import { flashSlotFire, logEvent } from "./feedback.js";
import { progressMissions } from "./data/missions.js";
import { showDamageNumber } from "./combat/damage-display.js";
import { sfxProjectileImpact } from "./audio/procedural.js";
import { spawnWreck } from "./wreck.js";
import { destroyAsteroid } from "./utils/mining.js";
import { C } from "./config/index.js";
import type { Enemy, Asteroid, WreckPiece } from "./types/world.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import type { WeaponProfile } from "./data/weaponProfiles.js";
import { playerHardpointRack } from "./utils/hardpoints.js";

function aimDeviationCone(baseScatter: number, distScatter: number, capRad: number, dist: number, accuracy: number): number {
  const totalScatter = (baseScatter + distScatter) / Math.max(0.1, accuracy);
  const coneHalf = Math.min(capRad, totalScatter / Math.max(1, dist));
  const u = Math.random() - Math.random();
  return u * coneHalf;
}

function computeAimDeviationInternal(target: Enemy | Asteroid | WreckPiece, turretMod: ModuleDef | null, wProf: WeaponProfile): { deviation: number; sig: number; dist: number } {
  const dist = Math.max(1, dst(getState().player.x, getState().player.y, target.x, target.y));
  const tracking = turretMod?.trackingSpeed ?? 0.5;
  const sig = (target as Enemy).sigRadius || 30;
  const delivery = (turretMod?.weaponDelivery ?? "projectile") as WeaponDelivery;
  const skillLvl = getState().player.skills[WEAPON_SKILL[delivery]] || 0;
  const skill = C.COMBAT.PLAYER_AIM.skillBase + skillLvl * C.COMBAT.PLAYER_AIM.skillPerWeaponLevel;
  const distRatio = Math.min(dist / Math.max(1, wProf.range), C.COMBAT.PLAYER_AIM.distanceRatioCap);
  const baseScatter = sig * C.COMBAT.PLAYER_AIM.sigMultiplier;
  const distScatter = distRatio * distRatio * C.COMBAT.PLAYER_AIM.distanceScatterBase;
  const trackPenalty = 1 / Math.max(C.COMBAT.PLAYER_AIM.trackingFloor, tracking);
  const transv = transversalVs(target as Enemy);
  const trackingThreshold = tracking * wProf.range * C.COMBAT.PLAYER_AIM.trackingThresholdMultiplier;
  const transvRatio = transv / Math.max(1, trackingThreshold);
  const transvScatter = Math.min(C.COMBAT.PLAYER_AIM.transversalCap, transvRatio) * C.COMBAT.PLAYER_AIM.transversalScatterBase;
  const deviation = aimDeviationCone((baseScatter + transvScatter) * trackPenalty, distScatter * trackPenalty, C.COMBAT.PLAYER_AIM.deviationCapRad, dist, skill);
  return { deviation, sig, dist };
}

export function computeHitChance(target: Enemy | Asteroid | WreckPiece | null, turretMod: ModuleDef | null, wProf: WeaponProfile): number {
  if (!target) return 1;
  const { deviation, sig, dist } = computeAimDeviationInternal(target, turretMod, wProf);
  const targetAngularSize = sig / dist;
  const ratio = targetAngularSize / Math.max(0.001, deviation);
  return Math.min(1, Math.max(0, (ratio - 0.3) / 0.7));
}

export function computeAimDeviation(target: Enemy | Asteroid | WreckPiece | null, turretMod: ModuleDef | null, wProf: WeaponProfile): number {
  if (!target) return 0;
  return computeAimDeviationInternal(target, turretMod, wProf).deviation;
}

export function computeEnemyAimDeviation(enemy: Enemy, dist: number): number {
  const accuracy = enemy.accuracy ?? 1.0;
  const baseScatter = C.COMBAT.ENEMY_AIM.baseScatter / Math.max(C.COMBAT.ENEMY_AIM.accuracyFloor, accuracy);
  const distRatio = Math.min(dist / C.COMBAT.ENEMY_AIM.distanceReference, C.COMBAT.ENEMY_AIM.distanceRatioCap);
  const distScatter = distRatio * distRatio * C.COMBAT.ENEMY_AIM.distanceScatterBase;
  return aimDeviationCone(baseScatter, distScatter, C.COMBAT.ENEMY_AIM.deviationCapRad, dist, accuracy);
}

function isTurretReady(idx: number): boolean {
  return (getState().player.turretPower?.[idx] ?? false) && (getState().player.turretPowerCd?.[idx] || 0) <= 0;
}

function getTurretWorldPos(turretIdx: number): { x: number; y: number } {
  const ship = SHIPS[getState().player.shipId];
  const offsets = ship?.render?.turretOffsets || [[24, 0]];
  const off = offsets[turretIdx % offsets.length] || offsets[0];
  const sa = getState().player.angle;
  return {
    x: getState().player.x + Math.cos(sa) * off[0] - Math.sin(sa) * off[1],
    y: getState().player.y + Math.sin(sa) * off[0] + Math.cos(sa) * off[1],
  };
}

export function fireSelectedTurret(isAutoFire = false) {
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) return;
  const slot = getState().player.fireControlSlot ?? 0;
  const uid = getState().player.fitting?.[playerHardpointRack(getState().player)]?.[slot];
  const inst = uid ? getState().player.moduleCargo.find(inst => inst.uid === uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m || MODULE_FLAGS.isMiningTurret(m) || !m.weaponDelivery) return;
  if (!isTurretReady(slot)) {
    if (!isAutoFire) floatText(getState().player.x, getState().player.y - 32, "TURRET OFFLINE", "#ff6644");
    return;
  }
  playerShoot(slot, null, isAutoFire);
}

export function updateTurretCooldowns(dt: number) {
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) return;
  const n = getState().player.turretCds?.length || 0;
  for (let i = 0; i < n; i++) {
    const nextCd = (getState().player.turretCds[i] || 0) - dt;
    if ((getState().player.turretCds[i] || 0) > 0) PlayerAccess.setTurretCd(i, nextCd);
  }

  const turretSlots = getState().player.fitting?.[playerHardpointRack(getState().player)] || [];
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const inst = getState().player.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m)) continue;
    if (!isTurretReady(i)) continue;
    if ((getState().player.turretCds?.[i] || 0) > 0) continue;

    const assignedId = getState().player.turretTargets?.[i];
    if (!assignedId) continue;

    const lockSlot = getState().player.lockQueue?.find((s) => s.id === assignedId && !s.resolving);
    if (!lockSlot) continue;

    const target = targetByLockId(assignedId);
    if (!target) continue;

    const dist = dst(getState().player.x, getState().player.y, target.x, target.y);
    const wProf = getWeaponProfileForSlot(i);
    if (!wProf || dist > wProf.range * C.COMBAT.TURRET_RANGE_OVERSHOOT) continue;

    playerShoot(i, target, true);
  }
}

function validatePlayerShootRequirements(
  slotIdx: number,
  isAutoFire: boolean
): { uid: string; inst: ModuleInstance; turretMod: ModuleDef; wProf: WeaponProfile; capNeed: number; ammoKey: string; ammoCost: number } | null {
  const p = getState().player;
  const uid = p.fitting?.[playerHardpointRack(p)]?.[slotIdx];
  if (!uid) return null;
  const inst = p.moduleCargo.find(inst => inst.uid === uid);
  if (!inst) return null;
  const turretMod = MODULES[inst.baseId];
  if (!turretMod) return null;
  if (MODULE_FLAGS.isMiningTurret(turretMod)) return null;

  const wProf = getWeaponProfileForSlot(slotIdx);
  if (!wProf) return null;

  if ((p.turretCds?.[slotIdx] || 0) > 0) return null;

  const capNeed = wProf.ec + CAP_FIRE_SURCHARGE;
  if (p.energy < capNeed) return null;

  const ammoKey = wProf.ammoType || "hybrid";
  const ammoCost = wProf.ammoPerShot ?? 1;
  if (ammoCost > 0 && (p.ammo[ammoKey as keyof typeof p.ammo] ?? 0) < ammoCost) {
    if (!isAutoFire) {
      floatText(p.x, p.y - 22, "NO AMMO", "#ff9944");
      logEvent("Weapon failed: ammunition depleted", "warn");
    }
    return null;
  }

  return { uid, inst, turretMod, wProf, capNeed, ammoKey, ammoCost };
}

function calculatePredictiveAimAngle(actualTarget: Enemy | Asteroid | WreckPiece | null, wProf: WeaponProfile): number {
  if (!actualTarget) {
    return aimAngle(getState().player.x, getState().player.y, Client.mouseWorld.x, Client.mouseWorld.y);
  }

  // Predictive aim: calculate intercept point
  const tx = actualTarget.x - getState().player.x;
  const ty = actualTarget.y - getState().player.y;
  const tvx = (actualTarget as Enemy).vx || 0;
  const tvy = (actualTarget as Enemy).vy || 0;
  const bspd = wProf.spd;

  // Solve for time 't' in: dist_sq = (tx + tvx*t)^2 + (ty + tvy*t)^2 = (bspd*t)^2
  // t^2(bspd^2 - tvx^2 - tvy^2) - 2t(tx*tvx + ty*tvy) - (tx^2 + ty^2) = 0
  const a = bspd * bspd - (tvx * tvx + tvy * tvy);
  const b = -2 * (tx * tvx + ty * tvy);
  const c = -(tx * tx + ty * ty);

  let t = 0;
  if (a === 0) {
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      t = (-b + Math.sqrt(disc)) / (2 * a);
    }
  }

  const ix = actualTarget.x + (t > 0 ? tvx * t : 0);
  const iy = actualTarget.y + (t > 0 ? tvy * t : 0);
  return Math.atan2(iy - getState().player.y, ix - getState().player.x);
}

function fireBeamWeapon(ox: number, oy: number, angle: number, wProf: WeaponProfile, finalDmg: number, delivery: WeaponDelivery) {
  const dx = Math.cos(angle), dy = Math.sin(angle), range = wProf.range;
  let hitDist = range, hitEnemy: Enemy | null = null;
  for (const e of liveEnemies()) {
    const ex = e.x - ox, ey = e.y - oy;
    const proj = ex * dx + ey * dy;
    if (proj < 0 || proj > range) continue;
    const hitR = (e.sigRadius || 30) * 0.6 + 8;
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp < hitR) {
      const surfaceDist = proj - Math.sqrt(Math.max(0, hitR * hitR - perp * perp));
      if (surfaceDist > 0 && surfaceDist < hitDist) {
        hitDist = surfaceDist;
        hitEnemy = e;
      }
    }
  }
  const ex2 = ox + dx * hitDist, ey2 = oy + dy * hitDist;
  spawnBeam(ox, oy, ex2, ey2, wProf.color, 3);
  if (hitEnemy) {
    damageEnemy(hitEnemy, finalDmg, ex2, ey2, getState().player, delivery);
    spawnBeamImpactSubtle(ex2, ey2, wProf.color);
    sfxProjectileImpact(ex2, ey2, "beam");
  } else {
    spawnParticles(ex2, ey2, wProf.trail, 1, 50);
  }
}

export function playerShoot(slotIdx = 0, targetEnemy: Enemy | Asteroid | WreckPiece | null = null, isAutoFire = false): boolean {
  ensureAmmoDefaults();
  const reqs = validatePlayerShootRequirements(slotIdx, isAutoFire);
  if (!reqs) return false;

  const { turretMod, wProf, capNeed, ammoKey, ammoCost } = reqs;
  const p = getState().player;
  const st = getStats();

  let actualTarget = targetEnemy;
  if (actualTarget && isTargetDestroyed(actualTarget)) actualTarget = null;

  const angle = calculatePredictiveAimAngle(actualTarget, wProf);
  const hitChance = actualTarget && !isAsteroidTarget(actualTarget.id)
    ? computeHitChance(actualTarget, turretMod, wProf)
    : 1;

  PlayerAccess.setTurretCd(slotIdx, wProf.rate);
  PlayerAccess.setEnergy(p.energy - capNeed);
  if (ammoKey !== "none") {
    const nextAmmo = (p.ammo[ammoKey as keyof typeof p.ammo] ?? 0) - ammoCost;
    PlayerAccess.setAmmo(ammoKey as "hybrid" | "missile", nextAmmo);
  }

  flashSlotFire(slotIdx);

  const pos = getTurretWorldPos(slotIdx);
  const muzzleIntensity = turretMod.weaponDelivery === "missile" ? C.COMBAT.MUZZLE_FLASH.missileIntensity : turretMod.weaponDelivery === "projectile" && wProf.dmg >= C.COMBAT.MUZZLE_FLASH.heavyProjectileDmgThreshold ? C.COMBAT.MUZZLE_FLASH.heavyProjectileIntensity : C.COMBAT.MUZZLE_FLASH.defaultIntensity;
  spawnMuzzleFlash(pos.x, pos.y, angle, wProf.color, muzzleIntensity);
  getState().pendingEffects.push({
    type: "weaponFire",
    payload: {
      delivery: turretMod.weaponDelivery!,
      typeId: turretMod.id,
      vol: 1,
      x: pos.x,
      y: pos.y,
    },
  });

  const delivery = (turretMod.weaponDelivery ?? "projectile") as WeaponDelivery;
  const weaponMult = st.weaponMult * (1 + weaponSkillBonus(delivery));
  
  // Calculate damage with variance (0.5 to 1.0 of base) and floor it. 
  // If base is low (like 3), this naturally creates 0-3 range with misses.
  const variance = 0.5 + Math.random() * 0.7; // 50% to 120%
  const finalDmg = Math.max(1, Math.floor(wProf.dmg * weaponMult * variance));

  const ox = pos.x, oy = pos.y;

  if (wProf.type === "beam") {
    fireBeamWeapon(ox, oy, angle, wProf, finalDmg, delivery);
  } else {
    addBullet({
      x: ox, y: oy, px: ox, py: oy,
      vx: Math.cos(angle) * wProf.spd,
      vy: Math.sin(angle) * wProf.spd,
      life: wProf.range / wProf.spd,
      dmg: finalDmg,
      color: wProf.color, sz: wProf.sz, trail: wProf.trail,
      owner: getState().player,
      kind: turretMod.weaponDelivery ?? null,
      weaponId: turretMod.id,
      hitChance,
    });
  }
  return true;
}

export function damageEnemy(e: Enemy, dmg: number, px: number, py: number, owner?: BulletOwner, weaponKind?: WeaponDelivery | string | null) {
  if (dmg <= 0) return;
  
  let displayType = "hit";
  let overflow = dmg;
  
  if (e.shield !== undefined && e.shield > 0) {
    displayType = "shield";
    e.shieldHitGlow = 1;
    e.shieldHitAngle = Math.atan2(py - e.y, px - e.x);
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
    if (overflow >= e.hp) {
      overflow -= e.hp;
      e.hp = 0;
    } else {
      e.hp -= overflow;
      overflow = 0;
    }
  }

  // Structure absorbs whatever overflows past hull (only ships with a structure layer)
  if (overflow > 0 && (e.maxStructure ?? 0) > 0) {
    displayType = "structure";
    e.structureHitGlow = 1;
    e.structure = (e.structure ?? 0) - overflow;
    if (e.structure < 0) e.structure = 0;
  }

  if (!owner || owner === getState().player) {
    e._lastPlayerHitAt = performance.now();
    if (weaponKind === "projectile" || weaponKind === "beam" || weaponKind === "missile") {
      e._lastPlayerHitKind = weaponKind;
    }
  }
  
  showDamageNumber(e.x, e.y - 14, dmg, displayType, "playerToEnemy");
  spawnImpactFlash(px || e.x, py || e.y, displayType === "shield" ? "#44ccff" : "#ff4422");
  if (e.hp <= 0 && (e.structure ?? 0) <= 0) killEnemy(e);
}


export function killEnemy(e: Enemy) {
  removeSensorLock(e.id);
  e.alive = false;
  e.respawnTimer = RESPAWN_S;
  const exScale = e.type === "raider" ? C.COMBAT.EXPLOSION_SCALE.raider : e.type === "pirate" ? C.COMBAT.EXPLOSION_SCALE.pirate : C.COMBAT.EXPLOSION_SCALE.default;
  const exTier: "small" | "medium" | "large" = e.type === "raider" ? "large" : e.type === "pirate" ? "medium" : "small";
  spawnExplosion(e.x, e.y, "#ff4422", exScale, exTier);
  getState().pendingEffects.push({
    type: "explosion",
    payload: {
      x: e.x,
      y: e.y,
      color: "#ff4422",
      scale: exScale,
      tier: exTier,
    },
  });

  const playerParticipated = e._lastPlayerHitAt && (performance.now() - e._lastPlayerHitAt) < PLAYER_PARTICIPATION_WINDOW_MS;
  if (playerParticipated) {
    if (e.faction !== "neutral") {
      PlayerAccess.setKills(getState().player.kills + 1);
      progressMissions("bounty", 1, e.type);
      addXp(XP_PER_KILL);
      const kind: WeaponDelivery = (e._lastPlayerHitKind as WeaponDelivery) ?? "projectile";
      const skillId = WEAPON_SKILL[kind];
      addSkillXp(skillId, 25);
      floatText(e.x, e.y - 35, `+${XP_PER_KILL} XP`, "#aaddff");
      logEvent(`Destroyed ${e.name} — +${XP_PER_KILL} XP · ~${e.credits} CR loot`, "combat");
      spawnWreck(e);
    } else {
      logEvent(`Destroyed ambient ship: ${e.name}`, "combat");
      spawnWreck(e);
    }
  } else {
    if (e.faction === "neutral") {
      logEvent(`Ambient ship destroyed: ${e.name}`, "combat");
    } else {
      floatText(e.x, e.y - 35, "Turret Kill", "#88aacc");
    }
    spawnWreck(e);
  }
}

export { normalizeProfile, applyResists } from "./combat/resists.js";
export { computeHitQuality } from "./combat/hit-quality.js";
export { damageAsteroid } from "./combat/damage-asteroid.js";
