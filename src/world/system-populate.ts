import { mkRng, rf, ri } from "../utils/math.js";
import { buildEnemyFromSpawn } from "../utils/spawn.js";
import { ENEMY_SPAWNS } from "../data/enemy-spawns.js";
import {
  TUTORIAL_STATION,
  TUTORIAL_BELT_RING_CENTER,
  TUTORIAL_BELT_RING_RADIUS,
  TUTORIAL_BELT_THICKNESS,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_GATE,
  TUTORIAL_START_PLANET,
  TUTORIAL_LOCAL_REGIONS,
  TUTORIAL_SPAWN,
} from "../data/tutorial-layout.js";
import { TAU } from "../constants.js";
import { C } from "../config/index.js";
import { ORE } from "../data/resources.js";
import { getState } from "../state-access.js";
import type { System } from "../types/system.js";
import { getNovusPrimeIdx } from "./galaxy-build.js";
import { buildTutorialHiddenSite, seedHiddenSites } from "./hidden-sites.js";
import { normalizeComposition, sortedCompositionEntries, type OreComposition } from "../utils/ore-naming.js";

export const SECTOR_OUTER_RADIUS = C.WORLD.SECTOR.outerRadius;
const SECTOR_BELT_CENTER = C.WORLD.SECTOR.beltCenter;
const SECTOR_BELT_SPREAD = C.WORLD.SECTOR.beltSpread;
const SECTOR_GATE_ORBIT = C.WORLD.SECTOR.gateOrbit;
const SECTOR_PLANET_ORBIT = C.WORLD.SECTOR.planetOrbit;
const TUTORIAL_RETURN_GATE_OFFSET = 260;

function orbitSpeedFor(x: number, y: number, f: () => number, multiplier = 1): number {
  const r = Math.max(1, Math.hypot(x, y));
  const o = C.WORLD.ORBITS;
  const dir = f() < 0.5 ? -1 : 1;
  const radiusScale = Math.pow(o.referenceRadius / r, o.radiusExponent);
  return dir * o.angularSpeedBase * radiusScale * rf(f, o.jitterMin, o.jitterMax) * multiplier;
}

export function makeAstShape(f: () => number): { shape: number[][]; shapeMax: number } {
  const n = ri(f, 7, 13);
  let shapeMax = 0;
  const shape = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const r = rf(f, 0.65, 1.1);
    if (r > shapeMax) shapeMax = r;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return { shape, shapeMax };
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
      orbitSpeed: orbitSpeedFor(starterX, starterY, f, C.WORLD.ORBITS.stationMultiplier),
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
      moons: 0,
      orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
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
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
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
      moons: 0,
      orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
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
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
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
      moons: 0,
      orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
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
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.stationMultiplier),
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
      moons: 0,
      orbitSpeed: orbitSpeedFor(px, py, f, C.WORLD.ORBITS.planetMultiplier),
    });
  }
}

function buildTutorialStations(sys: System) {
  const stationX = TUTORIAL_STATION.x;
  const stationY = TUTORIAL_STATION.y;
  sys.stations.push({
    id: `station-${sys.id}-academy-prime`,
    name: "Academy Prime Station",
    x: stationX,
    y: stationY,
    radius: 25,
    spin: 0.003,
    isHome: false,
    services: ["market", "industry", "repair"],
    safeRadius: 350,
    turrets: [],
    structureType: "standard",
    orbitSpeed: orbitSpeedFor(stationX, stationY, mkRng(sys.id + "-academy-prime-station"), C.WORLD.ORBITS.stationMultiplier * 0.08),
  });
}

function ensureTutorialPlanets(sys: System) {
  const alreadyHasStartPlanet = sys.planets.some((planet) =>
    Math.hypot(planet.x - TUTORIAL_START_PLANET.x, planet.y - TUTORIAL_START_PLANET.y) < 16,
  );
  if (alreadyHasStartPlanet) return;

  sys.planets.push({
    name: "Academy Prime",
    x: TUTORIAL_START_PLANET.x,
    y: TUTORIAL_START_PLANET.y,
    radius: 510,
    hue: 205,
    sat: 58,
    lit: 34,
    hasRing: true,
    ringTilt: 0.28,
    moons: 0,
    orbitSpeed: orbitSpeedFor(TUTORIAL_START_PLANET.x, TUTORIAL_START_PLANET.y, mkRng(sys.id + "-academy-prime"), C.WORLD.ORBITS.planetMultiplier * 0.08),
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
    const { shape, shapeMax } = makeAstShape(mkRng(sys.id + `${clusterKey}${i}`));
    sys.asteroids.push({
      id: `ast-${sys.id}-${clusterKey}-${i}`,
      x,
      y,
      px: x, py: y, vx: 0, vy: 0,
      radius: rad,
      shape,
      shapeMax,
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
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.asteroidMultiplier),
    });
  }
}

function buildTutorialAsteroids(sys: System, danger: number) {
  // Massive asteroid belt ring around the star for the tutorial (stress-test culling)
  const commonWeights = C.WORLD.ORE.commonWeights;
  const f = mkRng(sys.id + "belt");
  const ringR = TUTORIAL_BELT_RING_RADIUS;
  const halfThick = TUTORIAL_BELT_THICKNESS / 2;
  const count = ri(f, C.WORLD.TUTORIAL.belt.asteroidCountMin, C.WORLD.TUTORIAL.belt.asteroidCountMax);

  for (let i = 0; i < count; i++) {
    const angle = rf(f, 0, TAU);
    const radius = ringR + rf(f, -halfThick, halfThick);
    const x = Math.round(TUTORIAL_BELT_RING_CENTER.x + Math.cos(angle) * radius);
    const y = Math.round(TUTORIAL_BELT_RING_CENTER.y + Math.sin(angle) * radius);
    const maxHp = Math.floor(rf(f, C.WORLD.ASTEROIDS.hpMin, C.WORLD.ASTEROIDS.hpMax) * (1 + danger * C.WORLD.ASTEROIDS.hpDangerMultiplier));
    const rad = rf(f, C.WORLD.ASTEROIDS.radiusMin, C.WORLD.ASTEROIDS.radiusMax);
    const composition = randomAsteroidComposition(commonWeights, f);
    const astName = asteroidDisplayName(composition);
    const sAngle = rf(f, 0, TAU);
    const sVel = rf(f, C.WORLD.ASTEROIDS.spinVelMin, C.WORLD.ASTEROIDS.spinVelMax);
    rf(f, 0, TAU); // keep PRNG stream aligned
    const { shape, shapeMax } = makeAstShape(mkRng(sys.id + `belt${i}`));
    sys.asteroids.push({
      id: `ast-${sys.id}-belt-${i}`,
      x, y,
      px: x, py: y, vx: 0, vy: 0,
      radius: rad,
      shape,
      shapeMax,
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
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.asteroidMultiplier),
    });
  }
}

function randomAsteroidComposition(weights: OreComposition, f: () => number): OreComposition {
  const composition: Record<string, number> = {};
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const w = typeof weight === "number" ? weight : 0;
    if (w <= 0) continue;
    const variance = rf(f, 0.85, 1.15);
    const value = w * variance;
    composition[key] = value;
    total += value;
  }
  for (const key of Object.keys(composition)) {
    composition[key] /= total;
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
  if (sys.ready) {
    if (sys.idx === 0) ensureTutorialPlanets(sys);
    return;
  }
  sys.ready = true;

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
    const activationRadius = C.WORLD.GATES.radius * (C.WORLD.GATES.activationRadiusMult ?? 2.0);
    sys.gates.push({
      id: isTutorialSys && linkIdx === getNovusPrimeIdx()
        ? `gate-${sys.id}-graduation`
        : `gate-${sys.id}-to-${linkIdx}`,
      x,
      y,
      px: x, py: y,
      target: {
        kind: "local",
        x: 0,
        y: 0,
        label: `sector-${linkIdx}`,
      },
      targetSysIdx: linkIdx,
      radius: C.WORLD.GATES.radius,
      spin: rf(f, 0.004, 0.012),
      angle: Math.atan2(y, x) + Math.PI / 2,
      orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.gateMultiplier),
      activationRadius,
      fxProfile: "sector",
    });
  }

  // Local tutorial return gates bring cadets back to the Academy without adding
  // extra cross-system exits.
  if (isTutorialSys) {
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      if (reg.id === "tut-flight") continue;
      if (Math.hypot(reg.x - TUTORIAL_STATION.x, reg.y - TUTORIAL_STATION.y) < 1) continue;
      const len = Math.hypot(reg.x - TUTORIAL_STATION.x, reg.y - TUTORIAL_STATION.y) || 1;
      const nx = (reg.x - TUTORIAL_STATION.x) / len;
      const ny = (reg.y - TUTORIAL_STATION.y) / len;
      const x = Math.round(reg.x - nx * TUTORIAL_RETURN_GATE_OFFSET);
      const y = Math.round(reg.y - ny * TUTORIAL_RETURN_GATE_OFFSET);
      const activationRadius = C.WORLD.GATES.radius * (C.WORLD.GATES.activationRadiusMult ?? 2.0);
      sys.gates.push({
        id: `gate-${sys.id}-return-${reg.id}`,
        x,
        y,
        px: x, py: y,
        target: {
          kind: "local",
          x: TUTORIAL_STATION.x,
          y: TUTORIAL_STATION.y,
          label: "Academy",
        },
        radius: C.WORLD.GATES.radius,
        spin: rf(f, 0.004, 0.012),
        angle: Math.atan2(TUTORIAL_STATION.y - y, TUTORIAL_STATION.x - x),
        orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.gateMultiplier),
        activationRadius,
        fxProfile: "tutorial-return",
      });
    }

    // Dev convenience: warp gate from spawn straight to the Academy.
    const devGateX = Math.round(TUTORIAL_SPAWN.x);
    const devGateY = Math.round(TUTORIAL_SPAWN.y);
    const devActivationRadius = C.WORLD.GATES.radius * (C.WORLD.GATES.activationRadiusMult ?? 2.0);
    sys.gates.push({
      id: `gate-${sys.id}-dev-spawn-to-station`,
      x: devGateX,
      y: devGateY,
      px: devGateX,
      py: devGateY,
      target: {
        kind: "local",
        x: TUTORIAL_STATION.x,
        y: TUTORIAL_STATION.y,
        label: "Academy",
      },
      radius: C.WORLD.GATES.radius,
      spin: rf(f, 0.004, 0.012),
      angle: Math.atan2(TUTORIAL_STATION.y - devGateY, TUTORIAL_STATION.x - devGateX),
      orbitSpeed: orbitSpeedFor(devGateX, devGateY, f, C.WORLD.ORBITS.gateMultiplier),
      activationRadius: devActivationRadius,
      fxProfile: "temporary",
    });
  }

  // ── Station & Planet generation ──
  const isTutorial = sys.idx === 0;
  const isConcentric = sys.idx >= 1;

  if (isTutorial) {
    buildTutorialStations(sys);
    ensureTutorialPlanets(sys);
  } else if (isConcentric) {
    buildConcentricSystemEntities(sys, f);
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

  sys.enemyMap = new Map();
  for (const e of sys.enemies) sys.enemyMap.set(e.id, e);
  sys.asteroidMap = new Map();
  for (const a of sys.asteroids) sys.asteroidMap.set(a.id, a);
}
