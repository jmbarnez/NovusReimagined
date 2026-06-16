path = 'src/world/system-populate.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = 'function buildTutorialStations(sys: System) {'
end_marker = 'function buildTutorialAsteroids'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx >= 0 and end_idx >= 0:
    new_fn = (
        'function buildTutorialStations(sys: System) {\n'
        '  const stationX = TUTORIAL_STATION.x;\n'
        '  const stationY = TUTORIAL_STATION.y;\n'
        '  sys.stations.push({\n'
        '    id: station--academy-prime,\n'
        '    name: \"Academy Prime Station\",\n'
        '    x: stationX,\n'
        '    y: stationY,\n'
        '    radius: 40,\n'
        '    spin: 0.003,\n'
        '    isHome: false,\n'
        '    services: [\"market\", \"industry\", \"repair\"],\n'
        '    safeRadius: 800,\n'
        '    turrets: [],\n'
        '    structureType: \"standard\",\n'
        '    _orbitSpeed: orbitSpeedFor(stationX, stationY, mkRng(sys.id + \"-academy-prime-station\"), C.WORLD.ORBITS.stationMultiplier * 0.08),\n'
        '  });\n'
        '}\n'
        '\n'
    )
    content = content[:start_idx] + new_fn + content[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced buildTutorialStations')
else:
    print(f'start={start_idx}, end={end_idx}')
