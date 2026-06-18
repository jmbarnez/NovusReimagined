import { getState } from "../state-access.js";
import { activeSystemIndices } from "../utils/game.js";

type Orbitable = {
  x: number;
  y: number;
  px?: number;
  py?: number;
  vx?: number;
  vy?: number;
  angle?: number;
  spawnX?: number;
  spawnY?: number;
  orbitSpeed?: number;
};

function rotatePair(x: number, y: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: x * c - y * s,
    y: x * s + y * c,
  };
}

function rotateOrbitable(body: Orbitable, dt: number, rotateSpawn = false) {
  const speed = body.orbitSpeed;
  if (!speed) return;
  const angle = speed * dt;
  if (Math.abs(angle) < 1e-9) return;

  const oldX = body.x;
  const oldY = body.y;
  if (body.px !== undefined) body.px = oldX;
  if (body.py !== undefined) body.py = oldY;

  const next = rotatePair(oldX, oldY, angle);
  body.x = next.x;
  body.y = next.y;

  if (body.vx !== undefined && body.vy !== undefined) {
    const vel = rotatePair(body.vx, body.vy, angle);
    body.vx = vel.x;
    body.vy = vel.y;
  }

  if (body.angle !== undefined) body.angle += angle;

  if (rotateSpawn) {
    if (body.spawnX === undefined) body.spawnX = oldX;
    if (body.spawnY === undefined) body.spawnY = oldY;
    const spawn = rotatePair(body.spawnX, body.spawnY, angle);
    body.spawnX = spawn.x;
    body.spawnY = spawn.y;
  }
}

export function updateSystemOrbits(dt: number) {
  for (const sysIdx of activeSystemIndices()) {
    const sys = getState().GALAXY[sysIdx];
    if (!sys || sys.idx === 0) continue;

    for (const station of sys.stations) rotateOrbitable(station, dt);
    for (const gate of sys.gates) rotateOrbitable(gate, dt);
    for (const planet of sys.planets) rotateOrbitable(planet, dt);
    for (const asteroid of sys.asteroids) rotateOrbitable(asteroid, dt, true);
    for (const site of sys.hiddenSites || []) rotateOrbitable(site, dt);
  }
}
