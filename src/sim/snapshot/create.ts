import type { GameState, Player } from "../../state.js";
import { getStats } from "../../player/player-stats.js";
import type { AutoTarget } from "../../types/combat.js";
import type { EntitySnapshot, TargetLockSnapshot, WorldSnapshot } from "./types.js";
import { quantizeSnapshotNumber as q } from "./helpers.js";
import { getAssignTargetId } from "../../player/target-selection.js";

function snapshotTargetLock(target: AutoTarget | null | undefined): TargetLockSnapshot | null {
  if (!target) return null;
  return {
    id: target.id,
    x: q(target.x),
    y: q(target.y),
    hp: target.hp,
    name: target.name,
    alive: target.alive,
    depleted: target.depleted,
    sigRadius: target.sigRadius,
    vx: typeof target.vx === "number" ? q(target.vx) : undefined,
    vy: typeof target.vy === "number" ? q(target.vy) : undefined,
    radius: target.radius,
  };
}

function snapshotEntities(state: GameState, subject: Player): EntitySnapshot[] {
  const entities: EntitySnapshot[] = [];

  for (const b of state.bullets) {
    entities.push({
      id: b.id,
      type: "bullet",
      x: q(b.x), y: q(b.y), vx: q(b.vx), vy: q(b.vy),
      dmg: b.dmg, color: b.color, sz: b.sz, trail: b.trail,
      kind: b.kind as string | null, weaponId: b.weaponId,
      hitChance: b.hitChance, targetId: b.targetId,
      homingTurnRate: b.homingTurnRate, accel: b.accel, maxSpeed: b.maxSpeed,
      dmgProfile: b.dmgProfile ? JSON.parse(JSON.stringify(b.dmgProfile)) : undefined
    });
  }

  for (const eb of state.enemyBullets) {
    entities.push({
      id: eb.id,
      type: "enemyBullet",
      x: q(eb.x), y: q(eb.y), vx: q(eb.vx), vy: q(eb.vy),
      dmg: eb.dmg, color: eb.color, sz: eb.sz, trail: eb.trail,
      kind: eb.kind, ownerFaction: eb.ownerFaction, ownerId: eb.ownerId
    });
  }

  for (const b of state.beams) {
    entities.push({
      id: b.id,
      type: "beam",
      x: q(b.x1), y: q(b.y1), vx: q(b.x2 - b.x1), vy: q(b.y2 - b.y1),
      x1: q(b.x1), y1: q(b.y1), x2: q(b.x2), y2: q(b.y2),
      color: b.color, width: b.width, life: q(b.life),
    });
  }

  const sys = state.GALAXY[subject.sysIdx] || state.GALAXY[0];
  if (sys) {
    for (const en of sys.enemies) {
      if (en.alive) {
        entities.push({
          id: en.id,
          type: "enemy",
          x: q(en.x), y: q(en.y), vx: q(en.vx), vy: q(en.vy), angle: q(en.angle),
          hp: en.hp, maxHp: en.maxHp,
          enemyType: en.type,
          name: en.name,
          shield: en.shield,
          maxShield: en.maxShield,
          structure: en.structure,
          maxStructure: en.maxStructure,
          level: en.level,
          faction: en.faction,
          weaponRange: en.weaponRange,
          sigRadius: en.sigRadius,
          speed: en.speed,
        });
      }
    }

    for (const ast of sys.asteroids) {
      entities.push({
        id: ast.id,
        type: "asteroid",
        x: q(ast.x), y: q(ast.y), vx: q(ast.vx || 0), vy: q(ast.vy || 0),
        hp: ast.hp, maxHp: ast.maxHp, depleted: ast.depleted,
        spinAngle: q(ast.spinAngle), spinVel: q(ast.spinVel),
        radius: ast.radius,
        name: ast.name,
        composition: { ...ast.composition },
        richness: ast.richness,
        tintHue: ast.tintHue,
        tintSat: ast.tintSat,
      });
    }
  }

  if (state.players) {
    const selfNetId = subject.netId;
    for (const p of state.players.values()) {
      const netId = p.netId;
      if (!netId || netId === selfNetId || p.sysIdx !== subject.sysIdx) continue;
      entities.push({
        id: netId,
        type: "player",
        shipType: p.shipId,
        pilotName: p.pilotName?.trim() || undefined,
        x: q(p.x), y: q(p.y), vx: q(p.vx), vy: q(p.vy), angle: q(p.angle),
        hp: p.hp, maxHp: p.maxHp,
        boostLockout: false,
        miningLaser: p.miningLaser ? { ...p.miningLaser } : null,
        salvager: p.salvager ? { ...p.salvager } : null,
        tractor: p.tractor ? { ...p.tractor } : null,
      });
    }
  }

  for (const wp of state.wreckPieces) {
    entities.push({
      id: wp.id,
      type: "wreckpiece",
      x: q(wp.x), y: q(wp.y), vx: q(wp.vx), vy: q(wp.vy), angle: q(wp.angle),
      hp: wp.hp, maxHp: wp.maxHp,
      radius: wp.radius, pts: wp.pts, name: wp.name, age: wp.age, despawnTimer: wp.despawnTimer
    });
  }

  for (const sp of state.salvagePickups) {
    entities.push({
      id: sp.id,
      type: "salvagepickup",
      x: q(sp.x), y: q(sp.y), vx: q(sp.vx), vy: q(sp.vy),
      payload: sp.payload, qty: sp.qty, kind: sp.kind as string,
      composition: sp.composition ? { ...sp.composition } : undefined,
      name: sp.name,
      richness: sp.richness,
    });
  }

  return entities;
}

export function createSnapshot(tick: number, state: GameState, subject: Player): WorldSnapshot {
  return {
    tick,
    player: {
      netId: subject.netId,
      x: q(subject.x),
      y: q(subject.y),
      vx: q(subject.vx),
      vy: q(subject.vy),
      va: q(subject.va),
      angle: subject.angle,
      hp: subject.hp,
      maxHp: subject.maxHp ?? 100,
      shield: subject.shield,
      maxShield: subject.maxShield ?? 100,
      energy: subject.energy,
      maxEnergy: getStats(subject).maxEnergy,
      boostLockout: false,
      credits: subject.credits,
      sysIdx: subject.sysIdx,
      homeSysIdx: subject.homeSysIdx,
      miningLaser: subject.miningLaser ? { ...subject.miningLaser } : null,
      salvager: subject.salvager ? { ...subject.salvager } : null,
      tractor: subject.tractor ? { ...subject.tractor } : null,
      gateCooldowns: subject.gateCooldowns ? { ...subject.gateCooldowns } : null,
      gatesCleared: subject.gatesCleared ? [ ...subject.gatesCleared ] : null,
      warpCooldown: typeof subject.warpCooldown === "number" ? q(subject.warpCooldown) : undefined,
      warpTargetIdx: typeof subject.warpTargetIdx === "number" ? subject.warpTargetIdx : undefined,
      targetLock: snapshotTargetLock(subject.targetLock),
      lockQueue: subject.lockQueue ? subject.lockQueue.map(s => ({ ...s })) : null,
      _assignTargetId: getAssignTargetId(subject.netId ?? subject.shipId),
      turretTargets: subject.turretTargets ? [ ...subject.turretTargets ] : null,
      highTargets: subject.highTargets ? [ ...subject.highTargets ] : null,
      turretCds: subject.turretCds ? [ ...subject.turretCds ] : null,
      moduleHp: subject.moduleHp ? JSON.parse(JSON.stringify(subject.moduleHp)) : null,
      fitting: subject.fitting ? JSON.parse(JSON.stringify(subject.fitting)) : null,
      ore: subject.ore ? { ...subject.ore } : null,
      mixedOreCargo: subject.mixedOreCargo ? subject.mixedOreCargo.map((slot) => ({
        name: slot.name,
        qty: slot.qty,
        composition: { ...slot.composition },
        richness: slot.richness ?? 1,
      })) : null,
      bulkMaterialsCargo: subject.bulkMaterialsCargo ? subject.bulkMaterialsCargo.map((stack) => ({
        ...stack,
        composition: { ...stack.composition },
      })) : null,
      loot: subject.loot ? { ...subject.loot } : null,
      components: subject.components ? { ...subject.components } : null,
      ammo: subject.ammo ? { ...subject.ammo } : null,
      blueprints: subject.blueprints ? { ...subject.blueprints } : null,
      skills: subject.skills ? { ...subject.skills } : null,
      skillXp: subject.skillXp ? { ...subject.skillXp } : null,
      xp: subject.xp,
      level: subject.level,
      craftQueue: subject.craftQueue ? subject.craftQueue.map((job) => ({ ...job })) : null,
      hubQueue: subject.hubQueue ? subject.hubQueue.map((job) => ({ ...job })) : null,
      hubOutput: subject.hubOutput ? JSON.parse(JSON.stringify(subject.hubOutput)) : null,
      hubDeposit: subject.hubDeposit ? JSON.parse(JSON.stringify(subject.hubDeposit)) : null,
      moduleCargo: subject.moduleCargo
        ? subject.moduleCargo.map((inst) => ({
          ...inst,
          affixes: inst.affixes.map((affix) => ({ ...affix })),
        }))
        : null,
      contracts: subject.contracts ? subject.contracts.map((contract) => ({ ...contract, objective: { ...contract.objective } })) : null,
      stationOffers: subject.stationOffers ? subject.stationOffers.map((c) => ({ ...c })) : null,
      stationOfferStationId: subject.stationOfferStationId ?? null,
    },
    entities: snapshotEntities(state, subject),
  };
}
