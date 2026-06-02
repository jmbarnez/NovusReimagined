import { mkRng, rf, ri } from "../utils/math.js";
import { buildEnemyFromSpawn } from "../utils/spawn.js";
import { ENEMY_SPAWNS } from "../data/enemy-spawns.js";
import {
  TUTORIAL_STATION,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_GATE,
} from "../data/tutorial-layout.js";
import { TAU } from "../constants.js";
import { C } from "../config/index.js";
import { ORE } from "../data/resources.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { getNovusPrimeIdx } from "./galaxy-build.js";
import { buildTutorialHiddenSite, seedHiddenSites } from "./hidden-sites.js";
import { normalizeComposition, sortedCompositionEntries, type OreComposition } from "../utils/ore-naming.js";

export const SECTOR_OUTER_RADIUS = C.WORLD.SECTOR.outerRadius;
const SECTOR_BELT_CENTER = C.WORLD.SECTOR.beltCenter;
const SECTOR_BELT_SPREAD = C.WORLD.SECTOR.beltSpread;
const SECTOR_GATE_ORBIT = C.WORLD.SECTOR.gateOrbit;
const SECTOR_PLANET_ORBIT = C.WORLD.SECTOR.planetOrbit;

function orbitSpeedFor(x: number, y: number, f: () => number, multiplier = 1): number {
  const r = Math.max(1, Math.hypot(x, y));
  const o = C.WORLD.ORBITS;
  const dir = f() < 0.5 ? -1 : 1;
  const radiusScale = Math.pow(o.referenceRadius / r, o.radiusExponent);
  return dir * o.angularSpeedBase * radiusScale * rf(f, o.jitterMin, o.jitterMax) * multiplier;
}

export function makeAstShape(f: () => number): number[][] {
  const n = ri(f, 7, 13);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    return [Math.cos(a) * rf(f, 0.65, 1.1), Math.sin(a) * rf(f, 0.65, 1.1)];
  });
}

function buildConcentricSystemEntities(sys: System, f: () => number) {
  const idx = sys.idx;
  const sec = C.WORLD.CONCENTRIC.sectors.find((s) => s.idx === idx);
  if (!sec) return;
  const cx = sec.x;
  const cy = sec.y;

  if (idx === 1) {
    const starterAngle = -0.45;
    const starterOrbit = 1800;
    const starterX = cx + Math.round(Math.cos(starterAngle) * starterOrbit);
    const starterY = cy + Math.round(Math.sin(starterAngle) * starterOrbit);
    const turretCount1 = C.WORLD.STATIONS.turretCountHome;
    const turrets1 = [];
    for (let t = 0; t < turretCount1; t++) {
      turrets1.push({
        angle: (t / turretCount1) * TAU,
        orbitRadius: C.WORLD.STATIONS.otherRadius * C.WORLD.STATIONS.turretOrbitRadiusMultiplier,
        orbitSpeed: rf(f, C.WORLD.STATIONS.turretOrbitSpeedMin, C.WORLD.STATIONS.turretOrbitSpeedMax),
        shootCd: rf(f, 0, C.WORLD.STATIONS.turretShootCdMax),
      });
    }
    sys.stations.push({
      id: `station-${sys.id}-0`,
      name: "Novus Starter Hub",
      x: starterX, y: starterY,
      radius: C.WORLD.STATIONS.otherRadius,
      spin: 0.003,
      isHome: true,
      services: ["market", "industry", "repair"],
      safeRadius: C.WORLD.STATIONS.safeRadiusHighSec,
      turrets: turrets1,
      _orbitSpeed: orbitSpeedFor(starterX, starterY, f, C.WORLD.ORBITS.stationMultiplier),
    });

    const pOrbit = 3800;
    const pAngle = rf(f, 0, TAU);
    const px = cx + Math.round(Math.cos(pAngle) * pOrbit);
    const py = cy + Math.round(Math.sin(pAngle) * pOrbit);
    sys.planets.push({
      x: px, y: py,
      radius: 110,
      hue: 200, sat: 50, lit: 25,
      hasRing: true, ringTilt: 0.3,
      moons: 2,
      _orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
    });
  } else if (idx === 2) {
    const angle = 1.2;
    const orbit = 1200;
    const x = cx + Math.round(Math.cos(angle) * orbit);
    const y = cy + Math.round(Math.sin(angle) * orbit);
    const turretCount = C.WORLD.STATIONS.turretCountMidSec;
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
      name: "Belt Outpost Gamma",
      x, y,
      radius: C.WORLD.STATIONS.otherRadius,
      spin: 0.003,
      isHome: false,
      services: ["market", "repair"],
      safeRadius: C.WORLD.STATIONS.safeRadiusMidSec,
      turrets,
      _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
    });

    const pOrbit = 3000;
    const pAngle = rf(f, 0, TAU);
    const px = cx + Math.round(Math.cos(pAngle) * pOrbit);
    const py = cy + Math.round(Math.sin(pAngle) * pOrbit);
    sys.planets.push({
      x: px, y: py,
      radius: 70,
      hue: 25, sat: 40, lit: 20,
      hasRing: false, ringTilt: 0,
      moons: 1,
      _orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
    });
  } else if (idx === 3) {
    const angle = -2.1;
    const orbit = 1500;
    const x = cx + Math.round(Math.cos(angle) * orbit);
    const y = cy + Math.round(Math.sin(angle) * orbit);
    sys.stations.push({
      id: `station-${sys.id}-0`,
      name: "Scrap Station Delta",
      x, y,
      radius: C.WORLD.STATIONS.otherRadius,
      spin: 0.003,
      isHome: false,
      services: ["market"],
      safeRadius: C.WORLD.STATIONS.safeRadiusLowSec,
      turrets: [],
      _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
    });

    const pOrbit = 3500;
    const pAngle = rf(f, 0, TAU);
    const px = cx + Math.round(Math.cos(pAngle) * pOrbit);
    const py = cy + Math.round(Math.sin(pAngle) * pOrbit);
    sys.planets.push({
      x: px, y: py,
      radius: 95,
      hue: 180, sat: 45, lit: 20,
      hasRing: true, ringTilt: -0.2,
      moons: 2,
      _orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
    });
  } else if (idx === 4) {
    const angle = 0.5;
    const orbit = 2000;
    const x = cx + Math.round(Math.cos(angle) * orbit);
    const y = cy + Math.round(Math.sin(angle) * orbit);
    sys.stations.push({
      id: `station-${sys.id}-0`,
      name: "Freeport Nine",
      x, y,
      radius: C.WORLD.STATIONS.otherRadius,
      spin: 0.003,
      isHome: false,
      services: ["market", "repair"],
      safeRadius: 0,
      turrets: [],
      _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
    });

    const pOrbit = 4000;
    const pAngle = rf(f, 0, TAU);
    const px = cx + Math.round(Math.cos(pAngle) * pOrbit);
    const py = cy + Math.round(Math.sin(pAngle) * pOrbit);
    sys.planets.push({
      x: px, y: py,
      radius: 120,
      hue: 280, sat: 50, lit: 15,
      hasRing: true, ringTilt: 0.45,
      moons: 3,
      _orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
    });
  }
}

function buildTutorialStations(sys: System) {
  sys.stations.push({
    id: `station-${sys.id}-academy`,
    name: "S.T.A.R.T Academy",
    x: TUTORIAL_STATION.x,
    y: TUTORIAL_STATION.y,
    radius: C.WORLD.STATIONS.otherRadius,
    spin: 0.003,
    isHome: false,
    services: ["market", "industry", "repair"],
    safeRadius: 800,
    turrets: [],
    structureType: "home",
  });
}

function spawnAsteroidCluster(
  sys: System,
  cx: number,
  cy: number,
  clusterKey: string,
  f: () => number,
  danger: number,
  perCluster?: { min: number; max: number },
  customWeights?: OreComposition,
) {
  const countMin = perCluster?.min ?? C.WORLD.ASTEROIDS.perCluster.min;
  const countMax = perCluster?.max ?? C.WORLD.ASTEROIDS.perCluster.max;

  for (let i = 0; i < ri(f, countMin, countMax); i++) {
    const sAng = rf(f, 0, TAU);
    const spr = rf(f, SECTOR_BELT_SPREAD.lo, SECTOR_BELT_SPREAD.hi);
    const maxHp = Math.floor(rf(f, C.WORLD.ASTEROIDS.hpMin, C.WORLD.ASTEROIDS.hpMax) * (1 + danger * C.WORLD.ASTEROIDS.hpDangerMultiplier));
    const rad = rf(f, C.WORLD.ASTEROIDS.radiusMin, C.WORLD.ASTEROIDS.radiusMax);

    const template = customWeights
      ?? (f() < C.WORLD.ORE.crystalChance
        ? C.WORLD.ORE.crystalWeights
        : f() < C.WORLD.ORE.carbonRichChance
          ? C.WORLD.ORE.carbonRichWeights
          : C.WORLD.ORE.commonWeights);
    const composition = randomAsteroidComposition(template, f);
    const astName = asteroidDisplayName(composition);

    const x = Math.round(cx + Math.cos(sAng) * spr);
    const y = Math.round(cy + Math.sin(sAng) * spr);
    const sAngle = rf(f, 0, TAU);
    const sVel = rf(f, C.WORLD.ASTEROIDS.spinVelMin, C.WORLD.ASTEROIDS.spinVelMax);
    rf(f, 0, TAU); // Consume to keep PRNG stream aligned
    sys.asteroids.push({
      id: `ast-${sys.id}-${clusterKey}-${i}`,
      x,
      y,
      px: 0, py: 0, vx: 0, vy: 0,
      radius: rad,
      shape: makeAstShape(mkRng(sys.id + `${clusterKey}${i}`)),
      hp: maxHp, maxHp,
      composition,
      name: astName,
      richness: 1 + danger * C.WORLD.ASTEROIDS.richnessDangerMultiplier,
      depleted: false, respawnTimer: 0,
      spinAngle: sAngle,
      spinVel: sVel,
      prevSpin: sAngle,
      tintHue: Math.round(rf(f, C.WORLD.ASTEROIDS.tintHueMin, C.WORLD.ASTEROIDS.tintHueMax)),
      tintSat: Math.round(rf(f, C.WORLD.ASTEROIDS.tintSatMin, C.WORLD.ASTEROIDS.tintSatMax)),
      _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.asteroidMultiplier),
    });
  }
}

function buildTutorialAsteroids(sys: System, danger: number) {
  // Ensure tutorial zone asteroids only contain iron ore for the mining tutorial
  const f = mkRng(sys.id + "-tut-belts");
  const ironOnly = { iron: 1 };
  for (let c = 0; c < 3; c++) {
    const ang = (c / 3) * TAU + rf(f, -0.3, 0.3);
    const dist = rf(f, 200, 350);
    const cx = Math.round(TUTORIAL_BELT_CENTER.x + Math.cos(ang) * dist);
    const cy = Math.round(TUTORIAL_BELT_CENTER.y + Math.sin(ang) * dist);
    spawnAsteroidCluster(
      sys,
      cx,
      cy,
      `belt-${c}`,
      mkRng(sys.id + `-belt-${c}`),
      danger,
      { min: 3, max: 4 },
      ironOnly,
    );
  }
}

function randomAsteroidComposition(template: OreComposition, f: () => number): OreComposition {
  const entries = Object.entries(normalizeComposition(template))
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { iron: 1 };

  const selected = new Set<string>();
  const maxOres = Math.min(5, entries.length);
  const targetCount = Math.min(maxOres, 1 + Math.floor(Math.pow(f(), 0.72) * maxOres));
  while (selected.size < targetCount) {
    const roll = f();
    let cum = 0;
    let picked = entries[entries.length - 1][0];
    for (const [key, weight] of entries) {
      cum += weight;
      if (roll <= cum) {
        picked = key;
        break;
      }
    }
    selected.add(picked);
  }

  const composition: OreComposition = {};
  for (const [key, weight] of entries) {
    if (!selected.has(key)) continue;
    composition[key] = weight * (0.75 + f() * 0.7);
  }
  return normalizeComposition(composition);
}

function asteroidDisplayName(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const first = sorted[0]?.[0] ?? "iron";
  const second = sorted[1]?.[0];
  const firstLabel = ORE[first]?.label.split(" ")[0] ?? first;
  if (!second || (sorted[1]?.[1] ?? 0) < 0.18) return `${firstLabel} Asteroid`;
  const secondLabel = ORE[second]?.label.split(" ")[0] ?? second;
  return `${firstLabel}-${secondLabel} Asteroid`;
}

export function populateSystem(sys: System) {
  if (sys._ready) return;
  sys._ready = true;

  const f = mkRng(sys.id + "-pop");
  const danger = Math.max(0, 1 - sys.security);

  // ── Warp gate generation ──
  const galaxy = getState().GALAXY;
  const isTutorialSys = sys.idx === 0;
  for (const linkIdx of sys.links) {
    let x: number;
    let y: number;
    if (isTutorialSys && linkIdx === getNovusPrimeIdx()) {
      x = TUTORIAL_GATE.x;
      y = TUTORIAL_GATE.y;
    } else {
      const target = galaxy?.[linkIdx];
      let gateAngle: number;
      if (target) {
        gateAngle = Math.atan2(target.mapY - sys.mapY, target.mapX - sys.mapX);
      } else {
        gateAngle = rf(f, 0, TAU);
      }
      gateAngle += (f() - 0.5) * C.WORLD.GATES.angleJitter;
      const gateDist = rf(f, SECTOR_GATE_ORBIT.lo, SECTOR_GATE_ORBIT.hi);
      x = Math.round(Math.cos(gateAngle) * gateDist);
      y = Math.round(Math.sin(gateAngle) * gateDist);
    }
    sys.gates.push({
      x,
      y,
      px: 0, py: 0,
      targetSysIdx: linkIdx,
      radius: C.WORLD.GATES.radius,
      spin: rf(f, 0.004, 0.012),
      _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.gateMultiplier),
    });
  }

  // Add a second gate near the Academy station in the tutorial system
  if (isTutorialSys) {
    const npIdx = getNovusPrimeIdx();
    const hasStationGate = sys.gates.some((g) => g.targetSysIdx === npIdx && Math.hypot(g.x + 500, g.y) < 200);
    if (!hasStationGate) {
      sys.gates.push({
        x: -500,
        y: 0,
        px: 0, py: 0,
        targetSysIdx: npIdx,
        radius: C.WORLD.GATES.radius,
        spin: rf(f, 0.004, 0.012),
        _orbitSpeed: orbitSpeedFor(-500, 0, f, C.WORLD.ORBITS.gateMultiplier),
      });
    }
  }

  // ── Station & Planet generation ──
  const isTutorial = sys.idx === 0;
  const isConcentric = sys.idx >= 1;

  if (isTutorial) {
    buildTutorialStations(sys);
  } else if (isConcentric) {
    buildConcentricSystemEntities(sys, f);
  }

  if (!isConcentric) {
    const planetCount = isTutorial ? 1 : ri(f, C.WORLD.PLANETS.countMin, C.WORLD.PLANETS.countMax);
    for (let i = 0; i < planetCount; i++) {
      const ang = isTutorial ? -Math.PI / 2 : rf(f, 0, TAU);
      const rad = isTutorial
        ? rf(f, 2200, 2800)
        : rf(f, SECTOR_PLANET_ORBIT.lo, Math.min(SECTOR_PLANET_ORBIT.hi, SECTOR_OUTER_RADIUS - 100));
      const x = Math.round(Math.cos(ang) * rad);
      const y = Math.round(Math.sin(ang) * rad);
      sys.planets.push({
        x,
        y,
        radius: rf(f, C.WORLD.PLANETS.radiusMin, C.WORLD.PLANETS.radiusMax),
        hue: ri(f, 0, C.WORLD.PLANETS.hueMax), sat: ri(f, C.WORLD.PLANETS.satMin, C.WORLD.PLANETS.satMax), lit: ri(f, C.WORLD.PLANETS.litMin, C.WORLD.PLANETS.litMax),
        hasRing: f() > C.WORLD.PLANETS.ringChance, ringTilt: rf(f, C.WORLD.PLANETS.ringTiltMin, C.WORLD.PLANETS.ringTiltMax),
        moons: ri(f, 0, C.WORLD.PLANETS.moonsMax),
        _orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.planetMultiplier),
      });
    }
  }

  // ── Asteroid generation ──
  if (isTutorial) {
    buildTutorialAsteroids(sys, danger);
  } else if (isConcentric) {
    const secConfig = C.WORLD.CONCENTRIC.sectors.find((s) => s.idx === sys.idx);
    const band = C.WORLD.CONCENTRIC.asteroids.find((a) => a.idx === sys.idx);
    if (secConfig && band) {
      const cx = secConfig.x;
      const cy = secConfig.y;
      for (let c = 0; c < band.clusters; c++) {
        const cAng = (c / band.clusters) * TAU + rf(f, -0.18, 0.18);
        const cDst = rf(f, band.lo, band.hi);
        const clX = cx + Math.cos(cAng) * cDst;
        const clY = cy + Math.sin(cAng) * cDst;
        spawnAsteroidCluster(sys, clX, clY, String(c), f, danger, undefined, band.weights);
      }
    }
  } else {
    const clusterCount = ri(f, C.WORLD.ASTEROIDS.clustersPerSystem.min, C.WORLD.ASTEROIDS.clustersPerSystem.max);
    for (let c = 0; c < clusterCount; c++) {
      const cAng = (c / clusterCount) * TAU + rf(f, -0.18, 0.18);
      const cDst = rf(f, SECTOR_BELT_CENTER.lo, SECTOR_BELT_CENTER.hi);
      const cx = Math.cos(cAng) * cDst;
      const cy = Math.sin(cAng) * cDst;
      spawnAsteroidCluster(sys, cx, cy, String(c), f, danger);
    }
  }

  // ── Hidden site generation ──
  if (isTutorial) {
    buildTutorialHiddenSite(sys);
  } else {
    seedHiddenSites(sys, f);
  }

  // Expand hand-authored spawn zones into enemy instances
  const spawnKey = sys.id;
  const zones = ENEMY_SPAWNS[spawnKey];
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
