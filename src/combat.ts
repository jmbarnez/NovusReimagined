import { G, Client } from "./state.js";
import { dst, aimAngle } from "./utils/math.js";
import { ensureAmmoDefaults, addXp, addSkillXp } from "./player/player-data.js";
import { getStats, getWeaponProfileForSlot, weaponSkillBonus } from "./player/player-stats.js";
import { WEAPON_SKILL, type WeaponDelivery } from "./data/skills.js";
import { CAP_FIRE_SURCHARGE, XP_PER_KILL, RESPAWN_S, PLAYER_PARTICIPATION_WINDOW_MS } from "./constants.js";
import { floatText, spawnParticles, spawnBeam, spawnBeamImpactSubtle, spawnImpactFlash, spawnExplosion, spawnShockwave, spawnMuzzleFlash } from "./utils/fx.js";
import { addBullet } from "./utils/entities.js";
import { clearSensorLocks, syncPrimaryTargetLock, targetByLockId, isAsteroidTarget, transversalVs } from "./targeting.js";
import { liveEnemies, curSys } from "./utils/game.js";
import { MODULES, MODULE_FLAGS } from "./data/modules.js";
import { SHIPS } from "./data/ships.js";
import { flashSlotFire, logEvent } from "./ui/hud-overlay.js";
import { progressMissions } from "./data/missions.js";
import { showDamageNumber } from "./combat/damage-display.js";
import { sfxWeaponFire, sfxShipExplosion, sfxProjectileImpact } from "./audio/procedural.js";
import { spawnWreck } from "./wreck.js";
import { C } from "./config/index.js";

function aimDeviationCone(baseScatter: number, distScatter: number, capRad: number, dist: number, accuracy: number): number {
  const totalScatter = (baseScatter + distScatter) / Math.max(0.1, accuracy);
  const coneHalf = Math.min(capRad, totalScatter / Math.max(1, dist));
  const u = Math.random() - Math.random();
  return u * coneHalf;
}

export function computeHitChance(target: any, turretMod: any, wProf: any): number {
  if (!target) return 1;
  const dist = Math.max(1, dst(G.P.x, G.P.y, target.x, target.y));
  const tracking = turretMod?.trackingSpeed ?? 0.5;
  const sig = target.sigRadius || 30;
  const delivery = (turretMod?.weaponDelivery ?? "projectile") as WeaponDelivery;
  const skillLvl = G.P.skills[WEAPON_SKILL[delivery]] || 0;
  const skill = C.COMBAT.PLAYER_AIM.skillBase + skillLvl * C.COMBAT.PLAYER_AIM.skillPerWeaponLevel;
  const distRatio = Math.min(dist / Math.max(1, wProf.range), C.COMBAT.PLAYER_AIM.distanceRatioCap);
  const baseScatter = sig * C.COMBAT.PLAYER_AIM.sigMultiplier;
  const distScatter = distRatio * distRatio * C.COMBAT.PLAYER_AIM.distanceScatterBase;
  const trackPenalty = 1 / Math.max(C.COMBAT.PLAYER_AIM.trackingFloor, tracking);
  const transv = transversalVs(target);
  const trackingThreshold = tracking * wProf.range * C.COMBAT.PLAYER_AIM.trackingThresholdMultiplier;
  const transvRatio = transv / Math.max(1, trackingThreshold);
  const transvScatter = Math.min(C.COMBAT.PLAYER_AIM.transversalCap, transvRatio) * C.COMBAT.PLAYER_AIM.transversalScatterBase;
  const deviation = aimDeviationCone((baseScatter + transvScatter) * trackPenalty, distScatter * trackPenalty, C.COMBAT.PLAYER_AIM.deviationCapRad, dist, skill);
  const targetAngularSize = sig / dist;
  const ratio = targetAngularSize / Math.max(0.001, deviation);
  return Math.min(1, Math.max(0, (ratio - 0.3) / 0.7));
}

export function computeAimDeviation(target: any, turretMod: any, wProf: any): number {
  if (!target) return 0;
  const dist = Math.max(1, dst(G.P.x, G.P.y, target.x, target.y));
  const tracking = turretMod?.trackingSpeed ?? 0.5;
  const sig = target.sigRadius || 30;
  const delivery = (turretMod?.weaponDelivery ?? "projectile") as WeaponDelivery;
  const skillLvl = G.P.skills[WEAPON_SKILL[delivery]] || 0;
  const skill = C.COMBAT.PLAYER_AIM.skillBase + skillLvl * C.COMBAT.PLAYER_AIM.skillPerWeaponLevel;
  const distRatio = Math.min(dist / Math.max(1, wProf.range), C.COMBAT.PLAYER_AIM.distanceRatioCap);
  const baseScatter = sig * C.COMBAT.PLAYER_AIM.sigMultiplier;
  const distScatter = distRatio * distRatio * C.COMBAT.PLAYER_AIM.distanceScatterBase;
  const trackPenalty = 1 / Math.max(C.COMBAT.PLAYER_AIM.trackingFloor, tracking);
  const transv = transversalVs(target);
  const trackingThreshold = tracking * wProf.range * C.COMBAT.PLAYER_AIM.trackingThresholdMultiplier;
  const transvRatio = transv / Math.max(1, trackingThreshold);
  const transvScatter = Math.min(C.COMBAT.PLAYER_AIM.transversalCap, transvRatio) * C.COMBAT.PLAYER_AIM.transversalScatterBase;
  return aimDeviationCone((baseScatter + transvScatter) * trackPenalty, distScatter * trackPenalty, C.COMBAT.PLAYER_AIM.deviationCapRad, dist, skill);
}

export function computeEnemyAimDeviation(enemy: any, dist: number): number {
  const accuracy = enemy.accuracy ?? 1.0;
  const baseScatter = C.COMBAT.ENEMY_AIM.baseScatter / Math.max(C.COMBAT.ENEMY_AIM.accuracyFloor, accuracy);
  const distRatio = Math.min(dist / C.COMBAT.ENEMY_AIM.distanceReference, C.COMBAT.ENEMY_AIM.distanceRatioCap);
  const distScatter = distRatio * distRatio * C.COMBAT.ENEMY_AIM.distanceScatterBase;
  return aimDeviationCone(baseScatter, distScatter, C.COMBAT.ENEMY_AIM.deviationCapRad, dist, accuracy);
}

function isTurretReady(idx: number): boolean {
  return (G.P.turretPower?.[idx] ?? false) && (G.P.turretPowerCd?.[idx] || 0) <= 0;
}

function getTurretWorldPos(turretIdx: number): { x: number; y: number } {
  const ship = SHIPS[G.P.shipId];
  const offsets = ship?.render?.turretOffsets || [[24, 0]];
  const off = offsets[turretIdx % offsets.length] || offsets[0];
  const sa = G.P.angle;
  return {
    x: G.P.x + Math.cos(sa) * off[0] - Math.sin(sa) * off[1],
    y: G.P.y + Math.sin(sa) * off[0] + Math.cos(sa) * off[1],
  };
}

export function fireSelectedTurret(isAutoFire = false) {
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) return;
  const slot = G.P.fireControlSlot ?? 0;
  const uid = G.P.fitting?.turret?.[slot];
  const inst = uid ? G.P.moduleCargo.find(inst => inst.uid === uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m || MODULE_FLAGS.isMiningTurret(m) || !m.weaponDelivery) return;
  if (!isTurretReady(slot)) {
    if (!isAutoFire) floatText(G.P.x, G.P.y - 32, "TURRET OFFLINE", "#ff6644");
    return;
  }
  playerShoot(slot, null, isAutoFire);
}

export function updateTurretCooldowns(dt: number) {
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) return;
  const n = G.P.turretCds?.length || 0;
  for (let i = 0; i < n; i++) {
    if ((G.P.turretCds[i] || 0) > 0) G.P.turretCds[i] -= dt;
  }
  if (Client.mouse.firing) {
    fireSelectedTurret(true);
  }

  const turretSlots = G.P.fitting?.turret || [];
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m)) continue;
    if (!isTurretReady(i)) continue;
    if ((G.P.turretCds?.[i] || 0) > 0) continue;

    const assignedId = G.P.turretTargets?.[i];
    if (!assignedId) continue;

    const lockSlot = G.P.lockQueue?.find((s: any) => s.id === assignedId && !s.resolving);
    if (!lockSlot) continue;

    const target = targetByLockId(assignedId);
    if (!target) continue;

    const dist = dst(G.P.x, G.P.y, target.x, target.y);
    const wProf = getWeaponProfileForSlot(i);
    if (!wProf || dist > wProf.range * C.COMBAT.TURRET_RANGE_OVERSHOOT) continue;

    playerShoot(i, target, true);
  }
}

export function playerShoot(slotIdx = 0, targetEnemy: any = null, isAutoFire = false): boolean {
  ensureAmmoDefaults();
  const st = getStats();
  const uid = G.P.fitting?.turret?.[slotIdx];
  if (!uid) return false;
  const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
  if (!inst) return false;
  const turretMod = MODULES[inst.baseId];
  if (!turretMod) return false;
  if (MODULE_FLAGS.isMiningTurret(turretMod)) return false;

  const wProf = getWeaponProfileForSlot(slotIdx);
  if (!wProf) return false;

  if ((G.P.turretCds?.[slotIdx] || 0) > 0) return false;

  const capNeed = wProf.ec + CAP_FIRE_SURCHARGE;
  if (G.P.energy < capNeed) return false;

  const ammoKey = wProf.ammoType || "hybrid";
  const ammoCost = wProf.ammoPerShot ?? 1;
  if (ammoKey !== "none" && (G.P.ammo[ammoKey as keyof typeof G.P.ammo] ?? 0) < ammoCost) {
    if (!isAutoFire) {
      floatText(G.P.x, G.P.y - 22, "NO AMMO", "#ff9944");
      logEvent("Weapon failed: ammunition depleted", "warn");
    }
    return false;
  }

  let actualTarget = targetEnemy;
  if (actualTarget && actualTarget.alive === false) actualTarget = null;
  if (actualTarget && actualTarget.depleted === true) actualTarget = null;
  if (actualTarget && actualTarget.hp <= 0) actualTarget = null;

  let angle: number;
  if (actualTarget) {
    // Predictive aim: calculate intercept point
    const tx = actualTarget.x - G.P.x;
    const ty = actualTarget.y - G.P.y;
    const tvx = actualTarget.vx || 0;
    const tvy = actualTarget.vy || 0;
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
    angle = Math.atan2(iy - G.P.y, ix - G.P.x);
  } else {
    angle = aimAngle(G.P.x, G.P.y, Client.mouseWorld.x, Client.mouseWorld.y);
  }

  const hitChance = actualTarget && !isAsteroidTarget(actualTarget.id)
    ? computeHitChance(actualTarget, turretMod, wProf)
    : 1;

  G.P.turretCds[slotIdx] = wProf.rate;
  G.P.energy -= capNeed;
  if (ammoKey !== "none") G.P.ammo[ammoKey as keyof typeof G.P.ammo] -= ammoCost;

  flashSlotFire(slotIdx);

  const pos = getTurretWorldPos(slotIdx);
  const pan = (pos.y - G.P.y) / 20;

  const muzzleIntensity = turretMod.weaponDelivery === "missile" ? C.COMBAT.MUZZLE_FLASH.missileIntensity : turretMod.weaponDelivery === "projectile" && wProf.dmg >= C.COMBAT.MUZZLE_FLASH.heavyProjectileDmgThreshold ? C.COMBAT.MUZZLE_FLASH.heavyProjectileIntensity : C.COMBAT.MUZZLE_FLASH.defaultIntensity;
  spawnMuzzleFlash(pos.x, pos.y, angle, wProf.color, muzzleIntensity);
  sfxWeaponFire(turretMod.weaponDelivery!, turretMod.id, 1, pos.x, pos.y);

  const delivery = (turretMod.weaponDelivery ?? "projectile") as WeaponDelivery;
  const weaponMult = st.weaponMult * (1 + weaponSkillBonus(delivery));
  const finalDmg = Math.max(1, Math.floor(wProf.dmg * weaponMult));

  const ox = pos.x, oy = pos.y;

  if (wProf.type === "beam") {
    const dx = Math.cos(angle), dy = Math.sin(angle), range = wProf.range;
    let hitDist = range, hitEnemy = null;
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
      damageEnemy(hitEnemy, finalDmg, ex2, ey2, G.P, delivery);
      spawnBeamImpactSubtle(ex2, ey2, wProf.color);
      sfxProjectileImpact(ex2, ey2, "beam");
    } else {
      spawnParticles(ex2, ey2, wProf.trail, 1, 50);
    }
  } else {
    addBullet({
      x: ox, y: oy, px: ox, py: oy,
      vx: Math.cos(angle) * wProf.spd,
      vy: Math.sin(angle) * wProf.spd,
      life: wProf.range / wProf.spd,
      dmg: finalDmg,
      color: wProf.color, sz: wProf.sz, trail: wProf.trail,
      owner: G.P,
      kind: turretMod.weaponDelivery ?? null,
      weaponId: turretMod.id,
      hitChance,
    });
  }
  return true;
}

export function damageEnemy(e: any, dmg: number, px: number, py: number, owner?: any, weaponKind?: WeaponDelivery | string | null) {
  if (dmg <= 0) return;
  e.hp -= dmg;
  if (!owner || owner === G.P) {
    e._lastPlayerHitAt = performance.now();
    if (weaponKind === "projectile" || weaponKind === "beam" || weaponKind === "missile") {
      e._lastPlayerHitKind = weaponKind;
    }
  }
  floatText(e.x, e.y - 14, `-${dmg}`, "#ff6666", "#aa2222");
  spawnImpactFlash(px || e.x, py || e.y, "#ff4422");
  if (e.hp <= 0) killEnemy(e);
}

export function damageAsteroid(a: any, dmg: number, px: number, py: number) {
  if (dmg <= 0) return;
  a.hp -= dmg;
  floatText(a.x, a.y - a.radius - 8, `-${Math.round(dmg)}`, "#88bbff");
  spawnParticles(px || a.x, py || a.y, "#4488ff", 1, 50);
  if (a.hp <= 0) {
    a.depleted = true;
    spawnParticles(a.x, a.y, "#4488ff", 3, 60);
  }
}

export function killEnemy(e: any) {
  G.P.lockQueue = G.P.lockQueue.filter((s: any) => s.id !== e.id);
  syncPrimaryTargetLock();
  if (G.P.turretTargets) {
    for (let i = 0; i < G.P.turretTargets.length; i++) {
      if (G.P.turretTargets[i] === e.id) G.P.turretTargets[i] = null;
    }
  }
  e.alive = false;
  e.respawnTimer = RESPAWN_S;
  const exScale = e.type === "raider" ? C.COMBAT.EXPLOSION_SCALE.raider : e.type === "pirate" ? C.COMBAT.EXPLOSION_SCALE.pirate : C.COMBAT.EXPLOSION_SCALE.default;
  spawnExplosion(e.x, e.y, "#ff4422", exScale);
  spawnShockwave(e.x, e.y, "#ff4422", exScale);
  sfxShipExplosion(e.x, e.y, e.type === "raider" ? C.COMBAT.SFX_EXPLOSION_SCALE.raider : e.type === "pirate" ? C.COMBAT.SFX_EXPLOSION_SCALE.pirate : C.COMBAT.SFX_EXPLOSION_SCALE.default);

  const playerParticipated = e._lastPlayerHitAt && (performance.now() - e._lastPlayerHitAt) < PLAYER_PARTICIPATION_WINDOW_MS;
  if (playerParticipated) {
    G.P.kills++;
    progressMissions("bounty", 1, e.type);
    addXp(XP_PER_KILL);
    const kind: WeaponDelivery = (e._lastPlayerHitKind as WeaponDelivery) ?? "projectile";
    const skillId = WEAPON_SKILL[kind];
    addSkillXp(skillId, 25);
    floatText(e.x, e.y - 35, `+${XP_PER_KILL} XP`, "#aaddff");
    logEvent(`Destroyed ${e.name} — +${XP_PER_KILL} XP · ~${e.credits} CR loot`, "combat");
    spawnWreck(e);
  } else {
    floatText(e.x, e.y - 35, "Turret Kill", "#88aacc");
  }
}

