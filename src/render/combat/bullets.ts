/**
 * Bullet and projectile rendering (player and enemy bullets).
 */
import { Graphics } from "pixi.js";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { lerp } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";

import { hexStringToNumber } from "../cache.js";

export function syncBullets(bulletGfx: Graphics, alpha: number): void {
  bulletGfx.clear();
  const state = getState();
  const useFixedTickInterpolation = Client.multiplayerRole === "none";

  // Standard Player bullets
  if (state.bullets) {
    for (const b of state.bullets) {
      if (!isVisible(b.x, b.y, 14)) continue;
      const ix = useFixedTickInterpolation ? lerp(b.px, b.x, alpha) : b.x;
      const iy = useFixedTickInterpolation ? lerp(b.py, b.y, alpha) : b.y;
      const spd = Math.hypot(b.vx, b.vy);
      const kind = b.kind || "projectile";
      const isMissile = kind === "missile";
      const isGauss = b.weaponId === "tu-gauss";
      const colNum = hexStringToNumber(b.color);
      const trailColNum = hexStringToNumber(b.trail || b.color);

      // Bullet trail — fewer segments for lighter Graphics load
      const trailSegs = isMissile ? 3 : 2;
      if (spd > 0) {
        const ndx = -b.vx / spd;
        const ndy = -b.vy / spd;
        for (let t = trailSegs; t >= 1; t--) {
          const dist = b.sz * (isGauss ? 3.0 : 2.4) * t;
          const ta = (0.18 + (trailSegs - t) * 0.09) * (isMissile ? 0.85 : 1);
          const tr = b.sz * (0.85 - t * 0.16);

          bulletGfx.circle(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr))
            .fill({ color: trailColNum, alpha: ta });
        }
      }

      // Outer head glow
      const glowR = b.sz * (isGauss ? 4.3 : isMissile ? 3.4 : 2.8);
      const glowAlpha = isGauss ? 0.65 : 0.5;
      bulletGfx.circle(ix, iy, glowR).fill({ color: colNum, alpha: glowAlpha * 0.38 });

      // Core bullet / slug
      if (isGauss) {
        // Highly optimized oblong capsule slug shape (drawn as thick line with rounded caps)
        const ba = Math.atan2(b.vy, b.vx);
        const cos = Math.cos(ba);
        const sin = Math.sin(ba);
        const halfLen = b.sz * 1.4;
        bulletGfx.moveTo(ix - cos * halfLen, iy - sin * halfLen)
          .lineTo(ix + cos * halfLen, iy + sin * halfLen)
          .stroke({ color: colNum, width: b.sz * 1.3, cap: "round" })
          .moveTo(ix - cos * halfLen, iy - sin * halfLen)
          .lineTo(ix + cos * halfLen, iy + sin * halfLen)
          .stroke({ color: 0xffffff, width: b.sz * 0.4, alpha: 0.28, cap: "round" });
      } else if (isMissile) {
        bulletGfx.circle(ix, iy, b.sz * 0.9)
          .fill({ color: colNum })
          .stroke({ color: 0xffffff, width: 0.85, alpha: 0.28 });
      } else {
        bulletGfx.circle(ix, iy, b.sz)
          .fill({ color: colNum })
          .stroke({ color: 0xffffff, width: 0.85, alpha: 0.28 });
      }
    }
  }

  // Enemy bullets
  if (state.enemyBullets) {
    for (const b of state.enemyBullets) {
      if (!isVisible(b.x, b.y, 14)) continue;
      const ix = useFixedTickInterpolation ? lerp(b.px, b.x, alpha) : b.x;
      const iy = useFixedTickInterpolation ? lerp(b.py, b.y, alpha) : b.y;
      const spd = Math.hypot(b.vx, b.vy);
      const sz = b.sz || 3;
      const colStr = b.color || "#ff5533";
      const colNum = hexStringToNumber(colStr);
      const trailColNum = hexStringToNumber(b.trail || colStr);

      // Bullet trail
      if (spd > 0) {
        const ndx = -b.vx / spd;
        const ndy = -b.vy / spd;
        for (let t = 2; t >= 1; t--) {
          const dist = sz * 2.7 * t;
          const ta = (0.14 + (2 - t) * 0.065);
          const tr = sz * (0.8 - t * 0.14);
          
          bulletGfx.circle(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr))
            .fill({ color: trailColNum, alpha: ta });
        }
      }

      // Outer head glow
      const glowR = sz * 2.5;
      bulletGfx.circle(ix, iy, glowR).fill({ color: colNum, alpha: 0.16 });

      // Core slug
      bulletGfx.circle(ix, iy, sz)
        .fill({ color: colNum })
        .stroke({ color: 0xffffff, width: 0.8, alpha: 0.25 });
    }
  }
}
