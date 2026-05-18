import { G } from "../state.js";
import { dst, angleDiff } from "../utils/math.js";
import { addBullet } from "../utils/entities.js";
import {
  STATION_TURRET_RANGE,
  STATION_TURRET_DAMAGE,
  STATION_TURRET_RELOAD,
  STATION_TURRET_ALIGN_TOLERANCE,
} from "../constants.js";
import { liveEnemies } from "../utils/game.js";

export function updateStationTurrets(dt: number) {
  const sys = G.GALAXY[G.P.sysIdx];
  if (!sys || !sys.stations) return;

  for (const st of sys.stations) {
    if (!st.turrets || !st.turrets.length) continue;
    for (const t of st.turrets) {
      t.angle += t.orbitSpeed * dt;
      t.x = st.x + Math.cos(t.angle) * t.orbitRadius;
      t.y = st.y + Math.sin(t.angle) * t.orbitRadius;

      let best = null;
      let bestD = Infinity;
      for (const e of liveEnemies()) {
        const d = dst(t.x, t.y, e.x, e.y);
        if (d > STATION_TURRET_RANGE) continue;
        if (d > (st.safeRadius ?? 600)) continue;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }

      t.target = best || null;

      if (t.shootCd > 0) {
        t.shootCd -= dt;
      }

      if (!best) continue;

      const targetAngle = Math.atan2(best.y - t.y, best.x - t.x);
      const diff = Math.abs(angleDiff(t.faceAngle ?? t.angle, targetAngle));
      t.faceAngle = targetAngle;

      if (diff < STATION_TURRET_ALIGN_TOLERANCE || bestD < 80) {
        if (t.shootCd <= 0) {
          const spd = 580;
          const fireAngle = targetAngle + (Math.random() - Math.random()) * 0.06;
          addBullet({
            x: t.x,
            y: t.y,
            px: t.x,
            py: t.y,
            vx: Math.cos(fireAngle) * spd,
            vy: Math.sin(fireAngle) * spd,
            life: 1.6,
            dmg: STATION_TURRET_DAMAGE,
            color: "#66ccff",
            sz: 2.5,
            trail: "#4488aa",
            owner: "station",
            kind: "projectile",
            weaponId: "station-turret",
          });
          t.shootCd = STATION_TURRET_RELOAD + Math.random() * 0.25;
          t.muzzleFlash = 0.08;
        }
      }
    }
  }
}
