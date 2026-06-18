import type { System } from "../../types/system.js";
import type { Enemy } from "../../types/enemy.js";
import type { Asteroid } from "../../types/asteroid.js";
import type { SnapshotEntityMaps } from "./entity-maps.js";

export function applyEnemySnapshots(sys: System, maps: SnapshotEntityMaps): void {
  if (sys.enemies) {
    for (const e of sys.enemies) {
      const snapEnt = maps.enemies.get(e.id);
      if (snapEnt) {
        e.alive = true;
        e.x = snapEnt.x;
        e.y = snapEnt.y;
        e.vx = snapEnt.vx;
        e.vy = snapEnt.vy;
        e.angle = snapEnt.angle || 0;
        e.hp = snapEnt.hp || 0;
        e.maxHp = snapEnt.maxHp || 100;
        if (snapEnt.shield !== undefined) e.shield = snapEnt.shield;
        if (snapEnt.maxShield !== undefined) e.maxShield = snapEnt.maxShield;
        if (snapEnt.structure !== undefined) e.structure = snapEnt.structure;
        if (snapEnt.maxStructure !== undefined) e.maxStructure = snapEnt.maxStructure;
        maps.enemies.delete(e.id);
      } else {
        e.alive = false;
      }
    }

    for (const snapEnt of maps.enemies.values()) {
      const newEn: Enemy = {
        id: String(snapEnt.id),
        type: snapEnt.enemyType || "unknown",
        name: snapEnt.name || "Unknown",
        x: snapEnt.x,
        y: snapEnt.y,
        px: snapEnt.x,
        py: snapEnt.y,
        spawnX: snapEnt.x,
        spawnY: snapEnt.y,
        hp: snapEnt.hp || 0,
        maxHp: snapEnt.maxHp || 100,
        vx: snapEnt.vx,
        vy: snapEnt.vy,
        angle: snapEnt.angle || 0,
        prevAngle: snapEnt.angle || 0,
        speed: snapEnt.speed ?? 100,
        credits: 0,
        loot: {},
        alive: true,
        respawnTimer: 0,
        aggroRange: 250,
        sigRadius: snapEnt.sigRadius ?? 30,
        fitting: { turret: [], high: [], med: [], low: [] },
        turretCds: [],
        shield: snapEnt.shield ?? 0,
        maxShield: snapEnt.maxShield ?? 0,
        structure: snapEnt.structure ?? 0,
        maxStructure: snapEnt.maxStructure ?? 0,
        level: snapEnt.level ?? 1,
        faction: snapEnt.faction ?? "hostile",
        weaponRange: snapEnt.weaponRange,
      };
      sys.enemies.push(newEn);
    }
  }
}

export function applyAsteroidSnapshots(sys: System, maps: SnapshotEntityMaps): void {
  if (sys.asteroids) {
    for (const a of sys.asteroids) {
      const snapEnt = maps.asteroids.get(a.id);
      if (snapEnt) {
        a.depleted = !!snapEnt.depleted;
        a.x = snapEnt.x;
        a.y = snapEnt.y;
        a.vx = snapEnt.vx;
        a.vy = snapEnt.vy;
        a.hp = snapEnt.hp || 0;
        a.maxHp = snapEnt.maxHp || 100;
        a.spinAngle = snapEnt.spinAngle ?? a.spinAngle;
        a.spinVel = snapEnt.spinVel ?? a.spinVel;
        if (snapEnt.composition) a.composition = { ...snapEnt.composition };
        maps.asteroids.delete(a.id);
      }
    }

    for (const snapEnt of maps.asteroids.values()) {
      const newAst: Asteroid = {
        id: String(snapEnt.id),
        x: snapEnt.x,
        y: snapEnt.y,
        px: snapEnt.x,
        py: snapEnt.y,
        vx: snapEnt.vx,
        vy: snapEnt.vy,
        radius: snapEnt.radius ?? 20,
        shape: [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]],
        shapeMax: 1.0,
        hp: snapEnt.hp || 0,
        maxHp: snapEnt.maxHp || 100,
        composition: snapEnt.composition ? { ...snapEnt.composition } : { iron: 1 },
        richness: snapEnt.richness ?? 1,
        depleted: !!snapEnt.depleted,
        respawnTimer: 0,
        spinAngle: snapEnt.spinAngle ?? 0,
        spinVel: snapEnt.spinVel ?? 0,
        prevSpin: snapEnt.spinAngle ?? 0,
        tintHue: snapEnt.tintHue ?? 180,
        tintSat: snapEnt.tintSat ?? 40,
        name: snapEnt.name ?? "Asteroid",
      };
      sys.asteroids.push(newAst);
    }
  }
}

export function rebuildSystemEntityMaps(sys: System): void {
  sys.enemyMap = new Map();
  for (const e of sys.enemies) sys.enemyMap.set(e.id, e);
  sys.asteroidMap = new Map();
  for (const a of sys.asteroids) sys.asteroidMap.set(a.id, a);
}
