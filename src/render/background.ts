import { WorldAccess } from "../state-access.js";
import { Client } from "../state.js";

const DETAIL_MULT: Record<string, number> = { low: 0.5, medium: 0.75, high: 1.0 };

/**
 * Populate `state.STARS*` / `state.DUST` with detail-scaled starfield data.
 *
 * This file used to also draw the stars and silhouettes to a Canvas 2D screen canvas.
 * All of that drawing has been migrated to PixiJS — see:
 *   - src/render/pixi-background.ts (star + dust sprite layers)
 *   - src/render/pixi-celestial.ts  (gas-giant / derelict silhouettes)
 */
export function initBackgroundStars(detail = "high") {
  const mult = DETAIL_MULT[detail] ?? 1.0;
  const starsFar = Array.from({ length: Math.max(80, Math.round(220 * mult)) }, () => ({
    ox: Math.random() * 6000,
    oy: Math.random() * 6000,
    r: 0.10 + Math.pow(Math.random(), 3.0) * 0.4,
    a: 0.03 + Math.pow(Math.random(), 2.2) * 0.16,
    hue: Math.random() * 40,
  }));
  const stars = Array.from({ length: Math.max(55, Math.round(150 * mult)) }, () => ({
    ox: Math.random() * 4000,
    oy: Math.random() * 4000,
    r: 0.18 + Math.pow(Math.random(), 2.5) * 0.7,
    a: 0.07 + Math.pow(Math.random(), 2.0) * 0.32,
    hue: (Math.random() - 0.5) * 40,
  }));
  const starsNear = Array.from({ length: Math.max(10, Math.round(24 * mult)) }, () => {
    const bright = Math.random() < 0.20;
    return {
      ox: Math.random() * 3000,
      oy: Math.random() * 3000,
      r: bright ? 1.4 + Math.random() * 0.8 : 0.35 + Math.pow(Math.random(), 2.0) * 0.9,
      a: bright ? 0.55 + Math.random() * 0.20 : 0.15 + Math.pow(Math.random(), 2.0) * 0.35,
      hue: Math.random() * 50,
    };
  });
  const dust = Array.from({ length: Math.max(50, Math.round(150 * mult)) }, () => ({
    ox: Math.random() * 3000,
    oy: Math.random() * 3000,
    r: 0.05 + Math.random() * 0.1,
    a: 0.03 + Math.random() * 0.05,
    drift: 0.01 + Math.random() * 0.015,
    parallax: 0.10 + Math.random() * 0.10,
  }));
  WorldAccess.setStarsFar(starsFar);
  WorldAccess.setStars(stars);
  WorldAccess.setStarsNear(starsNear);
  WorldAccess.setDust(dust);
}
