import { random } from "../../utils/math.js";
import { getState } from "../../state-access.js";

export function updateEnemyRespawns(dt: number, sysIdx: number) {
  const sys = getState().GALAXY[sysIdx];
  if (!sys?.enemies) return;
  for (const e of sys.enemies) {
    if (e.faction === "neutral" || e.alive) continue;
    e.respawnTimer -= dt;
    if (e.respawnTimer > 0) continue;

    e.alive = true;
    e.hp = e.maxHp;
    e.structure = e.maxStructure;
    e.shield = e.maxShield;
    e.x = e.spawnX;
    e.y = e.spawnY;
    e.vx = 0;
    e.vy = 0;
    e.angle = random() * Math.PI * 2;
    e.targetingPlayer = false;
    e.hasLockOnPlayer = false;
    e.lockOnTimer = 0;
  }
}
