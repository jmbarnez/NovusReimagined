import re

path = 'src/world/system-populate.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ring belt imports
old_imp = '  TUTORIAL_STATION,\r\n  TUTORIAL_BELT_CENTER,\r\n  TUTORIAL_GATE,'
new_imp = '  TUTORIAL_STATION,\r\n  TUTORIAL_BELT_RING_CENTER,\r\n  TUTORIAL_BELT_RING_RADIUS,\r\n  TUTORIAL_BELT_THICKNESS,\r\n  TUTORIAL_BELT_CENTER,\r\n  TUTORIAL_GATE,'
content = content.replace(old_imp, new_imp)

# 2. Update buildTutorialStations
old_station = '''function buildTutorialStations(sys: System) {
  sys.stations.push({
    id: station--academy,
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
}'''

new_station = '''function buildTutorialStations(sys: System) {
  const stationX = TUTORIAL_STATION.x;
  const stationY = TUTORIAL_STATION.y;
  sys.stations.push({
    id: station--academy-prime,
    name: "Academy Prime Station",
    x: stationX,
    y: stationY,
    radius: 40,
    spin: 0.003,
    isHome: false,
    services: ["market", "industry", "repair"],
    safeRadius: 800,
    turrets: [],
    structureType: "standard",
    _orbitSpeed: orbitSpeedFor(stationX, stationY, mkRng(sys.id + "-academy-prime-station"), C.WORLD.ORBITS.stationMultiplier * 0.08),
  });
}'''
content = content.replace(old_station, new_station)

# 3. Update ensureTutorialPlanets: radius 170 -> 510, add orbitSpeed
old_planet = '''  sys.planets.push({
    x: TUTORIAL_START_PLANET.x,
    y: TUTORIAL_START_PLANET.y,
    radius: 170,
    hue: 205,
    sat: 58,
    lit: 34,
    hasRing: true,
    ringTilt: 0.28,
    moons: 0,
    _orbitSpeed: 0,
  });'''

new_planet = '''  sys.planets.push({
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
    _orbitSpeed: orbitSpeedFor(TUTORIAL_START_PLANET.x, TUTORIAL_START_PLANET.y, mkRng(sys.id + "-academy-prime"), C.WORLD.ORBITS.planetMultiplier * 0.08),
  });'''
content = content.replace(old_planet, new_planet)

# 4. Replace buildTutorialAsteroids
old_belt = '''function buildTutorialAsteroids(sys: System, danger: number) {
  // Ensure tutorial zone asteroids only contain iron ore for the mining tutorial
  const commonWeights = C.WORLD.ORE.commonWeights;
  const beltClusters = [
    { cx: TUTORIAL_BELT_CENTER.x, cy: TUTORIAL_BELT_CENTER.y, count: { min: 8, max: 12 } },
    { cx: TUTORIAL_BELT_CENTER.x + 600, cy: TUTORIAL_BELT_CENTER.y + 200, count: { min: 5, max: 8 } },
    { cx: TUTORIAL_BELT_CENTER.x - 400, cy: TUTORIAL_BELT_CENTER.y - 300, count: { min: 5, max: 8 } },
  ];

  for (const cluster of beltClusters) {
    spawnAsteroidCluster(sys, cluster.cx, cluster.cy, elt-, mkRng(sys.id + "belt"), danger, cluster.count, commonWeights);
  }
}'''

new_belt = '''function buildTutorialAsteroids(sys: System, danger: number) {
  // Thin asteroid belt ring around the star for the tutorial
  const commonWeights = C.WORLD.ORE.commonWeights;
  const f = mkRng(sys.id + "belt");
  const ringR = TUTORIAL_BELT_RING_RADIUS;
  const halfThick = TUTORIAL_BELT_THICKNESS / 2;
  const count = ri(f, 22, 32);

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
    sys.asteroids.push({
      id: st--belt-,
      x, y,
      px: x, py: y, vx: 0, vy: 0,
      radius: rad,
      shape: makeAstShape(mkRng(sys.id + elt)),
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
}'''
content = content.replace(old_belt, new_belt)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
