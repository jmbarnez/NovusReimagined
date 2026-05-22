import { mkRng, rf, ri, dst } from "./utils/math.js";
import { buildEnemyFromSpawn } from "./utils/spawn.js";
import { ENEMY_SPAWNS } from "./data/enemy-spawns.js";
import { TAU, ENEMY_MIN_DIST_HOME_STATION, ENEMY_MIN_DIST_NONHOME_STATION } from "./constants.js";
import { tintFor } from "./render/seeded-detail.js";
import { C } from "./config/index.js";
import { G } from "./state.js";
import type { System } from "./types/world.js";

export type NebulaArchetype = "pillars" | "wisps" | "dense" | "void" | "dust-lane";
export type StarClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";

function pickArchetype(rng: () => number, ring: number): NebulaArchetype {
  const t = rng();
  if (ring === 0) return t < 0.5 ? "void" : t < 0.85 ? "dust-lane" : "wisps";
  if (ring === 1) return t < 0.25 ? "void" : t < 0.55 ? "dust-lane" : t < 0.8 ? "wisps" : "pillars";
  if (ring === 2) return t < 0.15 ? "void" : t < 0.4 ? "wisps" : t < 0.7 ? "pillars" : "dense";
  return t < 0.1 ? "void" : t < 0.35 ? "wisps" : t < 0.7 ? "pillars" : "dense";
}

function pickStarClass(rng: () => number, ring: number): StarClass {
  const t = rng();
  if (ring === 0) return t < 0.6 ? "G" : "F";
  if (ring === 1) return t < 0.35 ? "G" : t < 0.55 ? "F" : t < 0.75 ? "K" : t < 0.9 ? "A" : "M";
  if (t < 0.15) return "M";
  if (t < 0.35) return "K";
  if (t < 0.55) return "G";
  if (t < 0.7) return "F";
  if (t < 0.85) return "A";
  if (t < 0.95) return "B";
  return "O";
}

const SYS_NAMES = [
  "S.T.A.R.T System", "Orbital Beta", "Sigma Station", "Drift Margin", "Outpost Kappa",
  "Void Reach", "Contested Zone", "Raider Expanse", "Dead Sector", "Forbidden Rim",
  "Frontier Belt", "Patrol Corridor", "Garrison Hub", "Borderzone Alpha", "Mining Colony",
  "Abandoned Relay", "Pirate Haven", "Null Terminus", "Convoy Lane", "Deep Expanse",
];

const RING_RADII = C.WORLD.GALAXY.ringRadii;
const RING_COUNTS = C.WORLD.GALAXY.ringCounts;

export const SECTOR_OUTER_RADIUS = C.WORLD.SECTOR.outerRadius;
const SECTOR_STATION_HOME = C.WORLD.SECTOR.stationHome;
const SECTOR_STATION_RING1 = C.WORLD.SECTOR.stationRing1;
const SECTOR_BELT_CENTER = C.WORLD.SECTOR.beltCenter;
const SECTOR_BELT_SPREAD = C.WORLD.SECTOR.beltSpread;
const SECTOR_GATE_ORBIT = C.WORLD.SECTOR.gateOrbit;
const SECTOR_PLANET_ORBIT = C.WORLD.SECTOR.planetOrbit;

export function buildGalaxy(): System[] {
  const nodes: System[] = [];
  let idx = 0;
  for (let ring = 0; ring < RING_COUNTS.length; ring++) {
    const n = RING_COUNTS[ring];
    for (let i = 0; i < n; i++) {
      const angle = ring === 0 ? 0 : (i / n) * TAU + ring * C.WORLD.GALAXY.ringAngleOffset;
      const f = mkRng(`sys-place-${idx}`);
      const jit = ring > 0 ? (f() - 0.5) * C.WORLD.GALAXY.ringJitter : 0;
      const sec = ring === 0 ? (idx === 0 ? 0.0 : C.WORLD.SECURITY.ring0)
        : ring === 1 ? rf(f, C.WORLD.SECURITY.ring1.lo, C.WORLD.SECURITY.ring1.hi)
          : ring === 2 ? rf(f, C.WORLD.SECURITY.ring2.lo, C.WORLD.SECURITY.ring2.hi)
            : rf(f, C.WORLD.SECURITY.ring3.lo, C.WORLD.SECURITY.ring3.hi);
      const visRng = mkRng(`sys-vis-${idx}`);
      const archetype = pickArchetype(visRng, ring);
      const starClass = pickStarClass(visRng, ring);
      const sunDir = visRng() * TAU;
      const tintRGB = tintFor(starClass);
      nodes.push({
        idx, id: `sys-${idx}`,
        name: (SYS_NAMES[idx] || `System ${idx}`) + (ring > 0 ? ` ${String.fromCharCode(64 + i)}` : ""),
        security: Math.round(sec * 10) / 10,
        mapX: Math.cos(angle) * RING_RADII[ring] + jit,
        mapY: Math.sin(angle) * RING_RADII[ring] + jit,
        ring,
        links: [],
        _ready: false,
        asteroids: [], enemies: [], gates: [], stations: [], planets: [],
        nebulaHues: (() => {
          const f = mkRng(`sys-hue-${idx}`);
          const h1 = ri(f, 0, 360);
          const h2 = (h1 + 40 + ri(f, 60, 180)) % 360;
          const h3 = (h1 + 40 + ri(f, 180, 300)) % 360;
          return [h1, h2, h3];
        })(),
        starHue: ri(mkRng(`sys-shue-${idx}`), 0, 360),
        archetype,
        starClass,
        sunDir,
        tintRGB,
        flareTint: 0,
        flareTimer: rf(visRng, 18, 55),
      });
      idx++;
    }
  }
  for (const sys of nodes) {
    const sorted = nodes.filter((b: System) => b !== sys)
      .sort((a: System, b: System) => dst(a.mapX, a.mapY, sys.mapX, sys.mapY) - dst(b.mapX, b.mapY, sys.mapX, sys.mapY));
    sorted.slice(0, 2 + (sys.idx % 2)).forEach((t: System) => {
      if (!sys.links.includes(t.idx)) sys.links.push(t.idx);
      if (!t.links.includes(sys.idx)) t.links.push(sys.idx);
    });
  }
  return nodes;
}

export function makeAstShape(f: () => number): number[][] {
  const n = ri(f, 7, 13);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    return [Math.cos(a) * rf(f, 0.65, 1.1), Math.sin(a) * rf(f, 0.65, 1.1)];
  });
}

export function populateSystem(sys: System) {
  if (sys._ready) return;
  sys._ready = true;
  const f = mkRng(sys.id + "-pop");
  const danger = Math.max(0, 1 - sys.security);

  // ── Warp gate generation ──
  // Place one gate per hyperlane link, aimed toward the linked system's map position.
  const galaxy = G.GALAXY;
  for (const linkIdx of sys.links) {
    const target = galaxy?.[linkIdx];
    let gateAngle: number;
    if (target) {
      gateAngle = Math.atan2(target.mapY - sys.mapY, target.mapX - sys.mapX);
    } else {
      gateAngle = rf(f, 0, TAU);
    }
    // Jitter so multiple gates to nearby systems don't stack perfectly
    gateAngle += (f() - 0.5) * C.WORLD.GATES.angleJitter;
    const gateDist = rf(f, SECTOR_GATE_ORBIT.lo, SECTOR_GATE_ORBIT.hi);
    sys.gates.push({
      x: Math.round(Math.cos(gateAngle) * gateDist),
      y: Math.round(Math.sin(gateAngle) * gateDist),
      px: 0, py: 0,
      targetSysIdx: linkIdx,
      radius: C.WORLD.GATES.radius,
      spin: rf(f, 0.004, 0.012),
    });
  }

  // ── Station generation ──
  const isStarter = sys.idx === 0;
  if (isStarter) {
    // Novus Starter Hub — compact outpost at origin with limited facilities
    const turretCount = 2;
    const turrets = [];
    for (let t = 0; t < turretCount; t++) {
      turrets.push({
        angle: (t / turretCount) * TAU,
        orbitRadius: C.WORLD.STATIONS.otherRadius * C.WORLD.STATIONS.turretOrbitRadiusMultiplier,
        orbitSpeed: rf(f, C.WORLD.STATIONS.turretOrbitSpeedMin, C.WORLD.STATIONS.turretOrbitSpeedMax),
        shootCd: rf(f, 0, C.WORLD.STATIONS.turretShootCdMax),
      });
    }
    sys.stations.push({
      id: `station-${sys.id}-0`,
      name: "Novus Starter Hub",
      x: 0, y: 0,
      radius: C.WORLD.STATIONS.otherRadius,
      spin: 0.003,
      isHome: false,
      services: ["repair"],
      safeRadius: C.WORLD.STATIONS.safeRadiusHighSec,
      turrets,
    });
    sys.stations.push({
      id: `station-${sys.id}-hub`,
      name: "Industrial Processing Hub",
      x: 900, y: 0,
      radius: Math.round(C.WORLD.STATIONS.otherRadius * 0.8),
      spin: 0.005,
      isHome: false,
      services: [],
      safeRadius: 0,
      turrets: [],
      structureType: "industrial",
      isProcessingHub: true,
      collectRadius: 220,
    });
  } else {
    // Normal systems: spawn a station for high-sec and mid-sec systems,
    // and a random chance for low-sec systems
    const hasStation = sys.security >= 0.4 || f() < 0.35;
    if (hasStation) {
      const isHome = sys.security >= 0.7;
      const stRadius = isHome ? C.WORLD.STATIONS.homeRadius : C.WORLD.STATIONS.otherRadius;
      const stOrbit = isHome
        ? rf(f, SECTOR_STATION_HOME.lo, SECTOR_STATION_HOME.hi)
        : rf(f, SECTOR_STATION_RING1.lo, SECTOR_STATION_RING1.hi);
      const stAngle = rf(f, 0, TAU);
      const turretCount = isHome ? C.WORLD.STATIONS.turretCountHome
        : sys.security >= 0.7 ? C.WORLD.STATIONS.turretCountHighSec
        : sys.security >= 0.4 ? C.WORLD.STATIONS.turretCountMidSec
        : C.WORLD.STATIONS.turretCountLowSec;
      const turrets = [];
      for (let t = 0; t < turretCount; t++) {
        turrets.push({
          angle: (t / turretCount) * TAU,
          orbitRadius: stRadius * C.WORLD.STATIONS.turretOrbitRadiusMultiplier,
          orbitSpeed: rf(f, C.WORLD.STATIONS.turretOrbitSpeedMin, C.WORLD.STATIONS.turretOrbitSpeedMax),
          shootCd: rf(f, 0, C.WORLD.STATIONS.turretShootCdMax),
        });
      }
      const safeRadius = sys.security >= 0.7 ? C.WORLD.STATIONS.safeRadiusHighSec
        : sys.security >= 0.4 ? C.WORLD.STATIONS.safeRadiusMidSec
        : C.WORLD.STATIONS.safeRadiusLowSec;
      sys.stations.push({
        id: `station-${sys.id}-0`,
        name: `${sys.name} Station`,
        x: Math.round(Math.cos(stAngle) * stOrbit),
        y: Math.round(Math.sin(stAngle) * stOrbit),
        radius: stRadius,
        spin: rf(f, 0.002, 0.006),
        isHome,
        services: ["market", "industry", "repair"],
        safeRadius,
        turrets,
      });
    }
  }

  for (let i = 0; i < ri(f, C.WORLD.PLANETS.countMin, C.WORLD.PLANETS.countMax); i++) {
    const ang = rf(f, 0, TAU);
    const rad = rf(f, SECTOR_PLANET_ORBIT.lo, Math.min(SECTOR_PLANET_ORBIT.hi, SECTOR_OUTER_RADIUS - 100));
    sys.planets.push({
      x: Math.round(Math.cos(ang) * rad), y: Math.round(Math.sin(ang) * rad),
      radius: rf(f, C.WORLD.PLANETS.radiusMin, C.WORLD.PLANETS.radiusMax),
      hue: ri(f, 0, C.WORLD.PLANETS.hueMax), sat: ri(f, C.WORLD.PLANETS.satMin, C.WORLD.PLANETS.satMax), lit: ri(f, C.WORLD.PLANETS.litMin, C.WORLD.PLANETS.litMax),
      hasRing: f() > C.WORLD.PLANETS.ringChance, ringTilt: rf(f, C.WORLD.PLANETS.ringTiltMin, C.WORLD.PLANETS.ringTiltMax),
      moons: ri(f, 0, C.WORLD.PLANETS.moonsMax),
    });
  }

  const oreNorm = C.WORLD.ORE.defaultWeights;

  for (let c = 0; c < ri(f, C.WORLD.ASTEROIDS.clustersPerSystem.min, C.WORLD.ASTEROIDS.clustersPerSystem.max); c++) {
    const cAng = rf(f, 0, TAU);
    const cDst = rf(f, SECTOR_BELT_CENTER.lo, SECTOR_BELT_CENTER.hi);
    const cx = Math.cos(cAng) * cDst, cy = Math.sin(cAng) * cDst;
    for (let i = 0; i < ri(f, C.WORLD.ASTEROIDS.perCluster.min, C.WORLD.ASTEROIDS.perCluster.max); i++) {
      const sAng = rf(f, 0, TAU), spr = rf(f, SECTOR_BELT_SPREAD.lo, SECTOR_BELT_SPREAD.hi);
      const maxHp = Math.floor(rf(f, C.WORLD.ASTEROIDS.hpMin, C.WORLD.ASTEROIDS.hpMax) * (1 + danger * C.WORLD.ASTEROIDS.hpDangerMultiplier));
      const rad = rf(f, C.WORLD.ASTEROIDS.radiusMin, C.WORLD.ASTEROIDS.radiusMax);

      const isCrystal = f() < C.WORLD.ORE.crystalChance;
      const myWeights = isCrystal ? C.WORLD.ORE.crystalWeights : oreNorm.slice();
      const crystals = [];
      if (isCrystal) {
        const cf = mkRng(sys.id + `ac${c}${i}`);
        const nC = ri(cf, C.WORLD.ASTEROIDS.crystalCountMin, C.WORLD.ASTEROIDS.crystalCountMax);
        for (let ci = 0; ci < nC; ci++) {
          const ca = rf(cf, 0, TAU);
          const cr = rf(cf, C.WORLD.ASTEROIDS.crystalRadiusMin, C.WORLD.ASTEROIDS.crystalRadiusMax);
          crystals.push({
            x: Math.cos(ca) * cr,
            y: Math.sin(ca) * cr,
            size: rf(cf, C.WORLD.ASTEROIDS.crystalSizeMin, C.WORLD.ASTEROIDS.crystalSizeMax),
            rot: rf(cf, 0, TAU),
          });
        }
      }

      const ores = ["Iron", "Crystal", "Exotic"];
      let maxWeightIdx = 0;
      for (let w = 1; w < 3; w++) {
        if ((myWeights[w] || 0) > (myWeights[maxWeightIdx] || 0)) {
          maxWeightIdx = w;
        }
      }
      const astName = `${ores[maxWeightIdx]} Asteroid`;

      sys.asteroids.push({
        id: `ast-${sys.id}-${c}-${i}`,
        x: Math.round(cx + Math.cos(sAng) * spr), y: Math.round(cy + Math.sin(sAng) * spr),
        px: 0, py: 0, vx: 0, vy: 0,
        radius: rad,
        shape: makeAstShape(mkRng(sys.id + `a${c}${i}`)),
        hp: maxHp, maxHp,
        oreWeights: myWeights,
        name: astName,
        hasCrystals: isCrystal,
        crystalHue: isCrystal ? ri(f, 185, 215) : 0,
        crystals,
        richness: 1 + danger * C.WORLD.ASTEROIDS.richnessDangerMultiplier,
        depleted: false, respawnTimer: 0,
        spinAngle: rf(f, 0, TAU), spinVel: rf(f, C.WORLD.ASTEROIDS.spinVelMin, C.WORLD.ASTEROIDS.spinVelMax),
        prevSpin: rf(f, 0, TAU),
        tintHue: Math.round(rf(f, C.WORLD.ASTEROIDS.tintHueMin, C.WORLD.ASTEROIDS.tintHueMax)),
        tintSat: Math.round(rf(f, C.WORLD.ASTEROIDS.tintSatMin, C.WORLD.ASTEROIDS.tintSatMax)),
      });
    }
  }

  // Expand hand-authored spawn zones into enemy instances
  const zones = ENEMY_SPAWNS[sys.id];
  if (zones) {
    let idx = 0;
    for (const zone of zones) {
      const zf = mkRng(sys.id + `-zone-${idx}`);
      for (const entry of zone.enemies) {
        for (let i = 0; i < entry.count; i++) {
          const en = buildEnemyFromSpawn(sys, zone, entry, idx, zf);
          sys.enemies.push(en);
          idx++;
        }
      }
    }
  }

  sys._enemyMap = new Map();
  for (const e of sys.enemies) sys._enemyMap.set(e.id, e);
  sys._asteroidMap = new Map();
  for (const a of sys.asteroids) sys._asteroidMap.set(a.id, a);
}
