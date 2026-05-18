import { G } from "../state.js";
import { getStats } from "../player/player-stats.js";
import { showDamageNumber } from "../combat/damage-display.js";
import { damageEnemy, damageAsteroid } from "../combat.js";
import { updateSensorLocks } from "../targeting.js";
import { spawnImpactFlash } from "../utils/fx.js";
import { floatText } from "../utils/fx.js";
import { removeBullet, updateBeams, updateParticles, updateShockwaves, updateFloatTexts } from "../utils/entities.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { sfxProjectileImpact, sfxBeamImpact } from "../audio/procedural.js";

export function updateCombat(dt: number) {
  const st = getStats();
  if (G.P.shootCd > 0) G.P.shootCd -= dt;
  if (G.P.targetLock) {
    const tl = G.P.targetLock;
    const lost = tl.alive === false || tl.depleted === true || tl.hp <= 0 || Math.hypot(G.P.x - tl.x, G.P.y - tl.y) > 3500;
    if (lost) G.P.targetLock = null;
  }
  updateSensorLocks(dt, st);
}

const _bHits: any[] = [];

function isPointInAsteroid(bx: number, by: number, ast: any, bSz: number): boolean {
  const dx = bx - ast.x;
  const dy = by - ast.y;
  
  // Quick bounds check
  const distSq = dx * dx + dy * dy;
  const maxR = ast.radius + bSz;
  if (distSq > maxR * maxR) return false;

  const cos = Math.cos(ast.spinAngle || 0);
  const sin = Math.sin(ast.spinAngle || 0);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  let inside = false;
  const shape = ast.shape;
  if (!shape) return distSq <= maxR * maxR;

  const r = ast.radius;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const xi = shape[i][0] * r, yi = shape[i][1] * r;
    const xj = shape[j][0] * r, yj = shape[j][1] * r;
    const intersect = ((yi > ly) !== (yj > ly)) && (lx < (xj - xi) * (ly - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function updateProjectiles(dt: number) {
  const grid = G.spatialGrid;

  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i]; b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    if (grid) {
      _bHits.length = 0;
      const bRad = b.sz || 2;
      grid.query(b.x, b.y, bRad + 5, "enemy", _bHits); // +5 for slight aim assist
      if (_bHits.length) {
        _bHits.sort((a, b) => a.dist - b.dist);
        const target = _bHits.find((h: any) => h.data && h.data.alive && h.data !== b.owner);
        if (target && target.data) {
          const rolledHit = Math.random() < (b.hitChance ?? 1);
          spawnImpactFlash(b.x, b.y, b.color || "#ff4422");
          if (b.owner === G.P) sfxProjectileImpact(b.x, b.y, b.weaponId || b.kind || "projectile");
          if (rolledHit) {
            damageEnemy(target.data, b.dmg, b.x, b.y, b.owner, b.kind);
          } else {
            // Decoupled: still show impact flash, but apply 0 damage and show MISS
            showDamageNumber(target.data.x, target.data.y - 14, "MISS", "miss", "projectileMiss");
          }
          b.life = 0;
        }
      }

      if (b.life > 0) {
        _bHits.length = 0;
        const moveDist = Math.max(0, Math.hypot(b.x - b.px, b.y - b.py));
        grid.query(b.x, b.y, bRad + moveDist, "asteroid", _bHits);
        
        if (_bHits.length) {
          _bHits.sort((a, b) => a.dist - b.dist);
          
          let hitX = b.x, hitY = b.y;
          
          const target = _bHits.find((h: any) => {
            const ast = h.data;
            if (!ast || ast.depleted || ast.hp <= 0) return false;
            
            // CCD: Raycast the bullet's path using sampled points to prevent clipping
            const steps = Math.ceil(moveDist / 5); 
            for (let i = 0; i <= steps; i++) {
               const t = steps === 0 ? 1 : i / steps;
               const tx = b.px + (b.x - b.px) * t;
               const ty = b.py + (b.y - b.py) * t;
               if (isPointInAsteroid(tx, ty, ast, bRad)) {
                  hitX = tx; hitY = ty;
                  return true;
               }
            }
            return false;
          });
          
          if (target && target.data) {
            const isMining = b.owner === G.P && b.weaponId && MODULE_FLAGS.isMiningTurret(MODULES[b.weaponId]);
            if (isMining) {
              damageAsteroid(target.data, b.dmg, hitX, hitY);
              sfxBeamImpact("mining", hitX, hitY);
            } else {
              sfxProjectileImpact(hitX, hitY, b.weaponId || b.kind || "projectile");
            }
            spawnImpactFlash(hitX, hitY, b.color || "#ff4422");
            b.life = 0;
          }
        }
      }
    }

    if (b.life <= 0) removeBullet(i);
  }

  updateBeams(dt);
  updateParticles(dt);
  updateShockwaves(dt);
  updateFloatTexts(dt);
}
