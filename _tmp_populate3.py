path = 'src/world/system-populate.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'function buildTutorialStations(sys: System) {\n  const stationX = TUTORIAL_START_PLANET.x + 220;\n  const stationY = TUTORIAL_START_PLANET.y - 120;\n  sys.stations.push({\n    id: station--academy-prime,\n    name: \"Academy Prime Station\",\n    x: stationX,\n    y: stationY,\n    radius: C.WORLD.STATIONS.otherRadius,\n    spin: 0.003,\n    isHome: false,\n    services: [\"market\", \"industry\", \"repair\"],\n    safeRadius: 800,\n    turrets: [],\n    structureType: \"standard\",\n    _orbitSpeed: orbitSpeedFor(stationX, stationY, mkRng(sys.id + \"-academy-prime-station\"), C.WORLD.ORBITS.stationMultiplier * 0.08),\n  });\n}'

new = 'function buildTutorialStations(sys: System) {\n  const stationX = TUTORIAL_STATION.x;\n  const stationY = TUTORIAL_STATION.y;\n  sys.stations.push({\n    id: station--academy-prime,\n    name: \"Academy Prime Station\",\n    x: stationX,\n    y: stationY,\n    radius: 40,\n    spin: 0.003,\n    isHome: false,\n    services: [\"market\", \"industry\", \"repair\"],\n    safeRadius: 800,\n    turrets: [],\n    structureType: \"standard\",\n    _orbitSpeed: orbitSpeedFor(stationX, stationY, mkRng(sys.id + \"-academy-prime-station\"), C.WORLD.ORBITS.stationMultiplier * 0.08),\n  });\n}'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced buildTutorialStations')
else:
    print('buildTutorialStations not found')
