import { random } from "../../utils/math.js";
import { getState } from "../../state-access.js";
import { spawnParticles } from "../../utils/fx.js";
import { ORE } from "../../data/resources.js";
import { dominantOreKey } from "../../utils/ore-naming.js";
import {
  AST_SPIN_RANGE,
  ASTEROID_VEL_DECAY,
} from "../../constants.js";

export function updateAsteroids(dt: number, sysIdx: number) {
  const sys = getState().GALAXY[sysIdx];
  if (!sys?.asteroids) return;

  const decay = Math.pow(ASTEROID_VEL_DECAY, dt);
  for (const a of sys.asteroids) {
    // Keep track of spawn coordinates for dynamic respawning
    if (a.spawnX === undefined) {
      a.spawnX = a.x;
      a.spawnY = a.y;
    }

    if (a.depleted) {
      a.respawnTimer -= dt;
      if (a.respawnTimer <= 0) {
        a.depleted = false;
        a.hp = a.maxHp;
        a.vx = 0;
        a.vy = 0;

        // Respawn near original coordinates with slight jitter
        const ang = random() * Math.PI * 2;
        const dist = random() * 80;
        const spawnX = a.spawnX ?? a.x;
        const spawnY = a.spawnY ?? a.y;
        a.x = spawnX + Math.cos(ang) * dist;
        a.y = spawnY + Math.sin(ang) * dist;

        // Mineral dust condensation cloud
        const key = dominantOreKey(a.composition);
        const color = (ORE[key] ?? ORE.iron).color;
        spawnParticles(a.x, a.y, color, 8, 45);
      }
      continue;
    }

    a.prevSpin = a.spinAngle;
    a.spinAngle += a.spinVel * dt;
    if (random() < 0.0005) a.spinVel = (random() - 0.5) * AST_SPIN_RANGE;

    if (a.vx || a.vy) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= decay;
      a.vy *= decay;
      if (Math.abs(a.vx) < 0.5 && Math.abs(a.vy) < 0.5) {
        a.vx = 0;
        a.vy = 0;
      }
    }
  }
}
