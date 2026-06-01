/**
 * PixiJS Combat & Projectile Renderer.
 * 
 * Migrates combat rendering from Canvas 2D to PixiJS:
 * - Bullets: Single-pass batch graphics rendering for trails, outer glow, and core slug shapes.
 * - Beams: Layered high-intensity line rendering with core glows.
 * - Mining Laser: Triple-layered glowing laser cord with contact glints.
 * - Salvager Beam: Dashed animated scanning beam with contact point sparkles.
 * - Tractor Beam: Multi-stop animated cyan force cords or red hazard lines.
 */
import { Container, Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import {
  getRenderedPlayerTurretOrigin,
  getRenderedEnemyTurretOrigin,
  getPlayerTurretOrigin,
  getEnemyTurretOrigin,
  getRenderedTurretOrigin,
} from "../combat/turret-origin.js";
import { getSalvagerBeam } from "../salvager.js";
import { getTractorBeam } from "../tractor.js";

const TAU = Math.PI * 2;

// ─── Graphics Containers ─────────────────────────────────────────────────────
let _bulletGfx: Graphics | null = null;
let _beamGfx: Graphics | null = null;
let _utilityGfx: Graphics | null = null;
let _currentNow = 0;

// Helper to convert hex color strings to hex numbers for PixiJS
function hexStringToNumber(hex: string): number {
  const clean = hex.replace("#", "");
  return parseInt(clean, 16) || 0xffffff;
}

/** Re-anchor beam start to the rendered belly turret mount when it originated from a ship. */
function resolveBeamStart(x1: number, y1: number, alpha: number, sys: System): { x: number; y: number } {
  if (getState().player) {
    const playerMount = getPlayerTurretOrigin(getState().player);
    if (Math.hypot(x1 - getState().player.x, y1 - getState().player.y) < 42 || Math.hypot(x1 - playerMount.x, y1 - playerMount.y) < 18) {
      return getRenderedPlayerTurretOrigin(alpha, getState().player);
    }
  }
  for (const e of sys?._liveEnemies ?? []) {
    const enemyMount = getEnemyTurretOrigin(e);
    const sigR = e.sigRadius ?? 20;
    if (Math.hypot(x1 - e.x, y1 - e.y) < sigR * 1.8 || Math.hypot(x1 - enemyMount.x, y1 - enemyMount.y) < 18) {
      return getRenderedEnemyTurretOrigin(e, alpha);
    }
  }
  return { x: x1, y: y1 };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiCombat(parent: Container): void {
  destroyPixiCombat();

  // Create single-pass graphics containers
  _bulletGfx = new Graphics();
  parent.addChild(_bulletGfx);

  _beamGfx = new Graphics();
  parent.addChild(_beamGfx);

  _utilityGfx = new Graphics();
  parent.addChild(_utilityGfx);
}

export function syncPixiCombat(now: number, alpha: number, sys: System): void {
  if (!_bulletGfx || !_beamGfx || !_utilityGfx) return;
  const useFixedTickInterpolation = Client.multiplayerRole === "none";

  // 1. Sync Bullets (Projectiles and Enemy Projectiles)
  _bulletGfx.clear();
  
  // Standard Player bullets
  if (getState().bullets) {
    for (const b of getState().bullets) {
      if (!isVisible(b.x, b.y, 14)) continue;
      const ix = useFixedTickInterpolation ? lerp(b.px, b.x, alpha) : b.x;
      const iy = useFixedTickInterpolation ? lerp(b.py, b.y, alpha) : b.y;
      const spd = Math.hypot(b.vx, b.vy);
      const kind = b.kind || "projectile";
      const isMissile = kind === "missile";
      const isGauss = b.weaponId === "tu-gauss";
      const colNum = hexStringToNumber(b.color);
      const trailColNum = hexStringToNumber(b.trail || b.color);

      // Bullet trail
      const trailSegs = isMissile ? 5 : isGauss ? 4 : 3;
      if (spd > 0) {
        const ndx = -b.vx / spd;
        const ndy = -b.vy / spd;
        for (let t = trailSegs; t >= 1; t--) {
          const dist = b.sz * (isGauss ? 3.2 : 2.5) * t;
          const ta = (0.12 + (trailSegs - t) * 0.06) * (isMissile ? 0.85 : 1);
          const tr = b.sz * (0.8 - t * (isGauss ? 0.1 : 0.14));
          
          _bulletGfx.circle(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr))
            .fill({ color: trailColNum, alpha: ta });
        }
      }

      // Outer head glow
      const glowR = b.sz * (isGauss ? 4 : isMissile ? 3.2 : 2.5);
      const glowAlpha = isGauss ? 0.65 : 0.5;
      _bulletGfx.circle(ix, iy, glowR).fill({ color: colNum, alpha: glowAlpha * 0.35 });

      // Core bullet / slug
      if (isGauss) {
        // Highly optimized oblong capsule slug shape (drawn as thick line with rounded caps)
        const ba = Math.atan2(b.vy, b.vx);
        const cos = Math.cos(ba);
        const sin = Math.sin(ba);
        const halfLen = b.sz * 1.4;
        _bulletGfx.moveTo(ix - cos * halfLen, iy - sin * halfLen)
          .lineTo(ix + cos * halfLen, iy + sin * halfLen)
          .stroke({ color: colNum, width: b.sz * 1.3, cap: "round" })
          .moveTo(ix - cos * halfLen, iy - sin * halfLen)
          .lineTo(ix + cos * halfLen, iy + sin * halfLen)
          .stroke({ color: 0xffffff, width: b.sz * 0.4, alpha: 0.28, cap: "round" });
      } else if (isMissile) {
        _bulletGfx.circle(ix, iy, b.sz * 0.9)
          .fill({ color: colNum })
          .stroke({ color: 0xffffff, width: 0.85, alpha: 0.28 });
      } else {
        _bulletGfx.circle(ix, iy, b.sz)
          .fill({ color: colNum })
          .stroke({ color: 0xffffff, width: 0.85, alpha: 0.28 });
      }
    }
  }

  // Enemy bullets
  if (getState().enemyBullets) {
    for (const b of getState().enemyBullets) {
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
          const dist = sz * 2.5 * t;
          const ta = (0.12 + (2 - t) * 0.06);
          const tr = sz * (0.8 - t * 0.14);
          
          _bulletGfx.circle(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr))
            .fill({ color: trailColNum, alpha: ta });
        }
      }

      // Outer head glow
      const glowR = sz * 2.5;
      _bulletGfx.circle(ix, iy, glowR).fill({ color: colNum, alpha: 0.12 });

      // Core slug
      _bulletGfx.circle(ix, iy, sz)
        .fill({ color: colNum })
        .stroke({ color: 0xffffff, width: 0.8, alpha: 0.25 });
    }
  }

  // 2. Sync Beams (Standard weapon beams)
  _beamGfx.clear();
  if (getState().beams) {
    for (const b of getState().beams) {
      const colNum = hexStringToNumber(b.color);
      const start = resolveBeamStart(b.x1, b.y1, alpha, sys);

      // Outer soft glow layer
      _beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: colNum, width: b.width * 5.0, alpha: b.life * 0.35, cap: "round" });

      // Main core layer
      _beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: colNum, width: b.width, alpha: b.life * 0.95, cap: "round" });

      // High intensity white center
      _beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: 0xffffff, width: b.width * 0.35, alpha: b.life * 0.85, cap: "round" });
    }
  }

  // 3. Sync Utility Beams (Mining Laser, Salvager, Tractor)
  _utilityGfx.clear();
  _currentNow = now;

  const beamOrigin = getState().player ? getRenderedPlayerTurretOrigin(alpha, getState().player) : null;

  // Local player beams
  const localPlayer = getState().player;
  if (localPlayer && beamOrigin) {
    const miningLaser = localPlayer.miningLaser;
    if (miningLaser?.active) {
      drawMiningLaser(
        beamOrigin.x,
        beamOrigin.y,
        miningLaser.x2,
        miningLaser.y2,
        miningLaser.phase,
        miningLaser.hitNx,
        miningLaser.hitNy,
        miningLaser.hitR
      );
    }
    const sv = getSalvagerBeam(localPlayer);
    if (sv && sv.active) {
      drawSalvagerBeam(beamOrigin.x, beamOrigin.y, sv.x2, sv.y2, sv.phase);
    }
    const tr = getTractorBeam(localPlayer);
    if (tr && (tr.active || tr.tooHeavy)) {
      drawTractorBeam(
        beamOrigin.x,
        beamOrigin.y,
        tr.x2,
        tr.y2,
        tr.phase,
        tr.active,
        tr.tooHeavy,
        localPlayer.tractorTightness ?? 0.5
      );
    }
  }

  // Remote player beams
  if (getState().players) {
    const localNetId = getState().player?.netId;
    for (const p of getState().players.values()) {
      if (p.netId && p.netId === localNetId) continue;
      const pOrigin = getRenderedTurretOrigin(p, alpha);

      if (p.miningLaser && p.miningLaser.active) {
        drawMiningLaser(
          pOrigin.x,
          pOrigin.y,
          p.miningLaser.x2,
          p.miningLaser.y2,
          p.miningLaser.phase,
          p.miningLaser.hitNx,
          p.miningLaser.hitNy,
          p.miningLaser.hitR
        );
      }
      if (p.salvager && p.salvager.active) {
        drawSalvagerBeam(pOrigin.x, pOrigin.y, p.salvager.x2, p.salvager.y2, p.salvager.phase);
      }
      if (p.tractor && (p.tractor.active || p.tractor.tooHeavy)) {
        drawTractorBeam(
          pOrigin.x,
          pOrigin.y,
          p.tractor.x2,
          p.tractor.y2,
          p.tractor.phase,
          p.tractor.active,
          p.tractor.tooHeavy,
          p.tractorTightness ?? 0.5
        );
      }
    }
  }
}

export function destroyPixiCombat(): void {
  if (_bulletGfx) { _bulletGfx.destroy(); _bulletGfx = null; }
  if (_beamGfx) { _beamGfx.destroy(); _beamGfx = null; }
  if (_utilityGfx) { _utilityGfx.destroy(); _utilityGfx = null; }
}

function drawMiningLaser(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  phase: number,
  hitNx: number,
  hitNy: number,
  hitR: number
) {
  if (!_utilityGfx) return;
  const pulse = 0.82 + 0.18 * Math.sin(_currentNow * 0.022);
  const hittingAsteroid = hitR > 0;
  let endX = x2, endY = y2;
  if (hittingAsteroid) {
    const osc = Math.sin(phase || 0) * 3.5;
    endX += -hitNy * osc;
    endY += hitNx * osc;
  }

  // Outer glow
  _utilityGfx.moveTo(x1, y1).lineTo(endX, endY)
    .stroke({ color: 0xffdc28, width: 10, alpha: 0.28 * pulse, cap: "round" });

  // Core saturated laser
  _utilityGfx.moveTo(x1, y1).lineTo(endX, endY)
    .stroke({ color: 0xffe650, width: 4.5, alpha: 0.65 * pulse, cap: "round" });

  // High intensity center line
  _utilityGfx.moveTo(x1, y1).lineTo(endX, endY)
    .stroke({ color: 0xffffb4, width: 1.8, alpha: 0.95 * pulse, cap: "round" });

  // Contact point — visible weld pool with occasional micro-sparks
  if (hittingAsteroid) {
    const flicker = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((phase || 0) * 3.2));
    const backA = Math.atan2(-hitNy, -hitNx);

    _utilityGfx.circle(endX, endY, 9).fill({ color: 0xffa020, alpha: flicker * 0.30 });
    _utilityGfx.circle(endX, endY, 4.5).fill({ color: 0xffcc44, alpha: flicker * 0.52 });
    _utilityGfx.circle(endX, endY, 1.8).fill({ color: 0xffffff, alpha: flicker * 0.90 });
    _utilityGfx.circle(endX, endY, 6.5).stroke({ color: 0xffe090, width: 1.1, alpha: flicker * 0.42 });

    for (let s = 0; s < 3; s++) {
      const gate = 0.5 + 0.5 * Math.sin((phase || 0) * (3.5 + s * 1.3) + s * 1.9);
      if (gate < 0.5) continue;
      const side = s === 1 ? -1 : 1;
      const sa = backA + side * (0.3 + gate * 0.45) + Math.sin((phase || 0) * (2 + s)) * 0.22;
      const len = 4 + gate * 11;
      _utilityGfx.moveTo(endX, endY)
        .lineTo(endX + Math.cos(sa) * len, endY + Math.sin(sa) * len)
        .stroke({ color: 0xffe8a0, width: 0.85, alpha: gate * 0.75, cap: "round" });
    }
  } else {
    // Fade point
    _utilityGfx.circle(endX, endY, 8).fill({ color: 0xffe650, alpha: pulse * 0.3 * pulse });
  }
}

function drawSalvagerBeam(x1: number, y1: number, x2: number, y2: number, phase: number) {
  if (!_utilityGfx) return;
  const pulse = 0.7 + 0.3 * Math.sin(phase * 2.5);

  // Outer glow
  _utilityGfx.moveTo(x1, y1).lineTo(x2, y2)
    .stroke({ color: 0x00cc44, width: 10, alpha: 0.18 * pulse, cap: "round" });

  // Core scanning laser (dashed simulation)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  
  // Draw dashed lines
  const dashLen = 14;
  const gapLen = 10;
  const totalSeg = dashLen + gapLen;
  const offset = (-phase * 16) % totalSeg;
  
  let currentDist = offset < 0 ? offset + totalSeg : offset;
  while (currentDist < len) {
    const nextDash = Math.min(len, currentDist + dashLen);
    if (currentDist >= 0) {
      _utilityGfx.moveTo(x1 + nx * currentDist, y1 + ny * currentDist)
        .lineTo(x1 + nx * nextDash, y1 + ny * nextDash)
        .stroke({ color: 0x00ff55, width: 2.5, alpha: 0.60 * pulse, cap: "round" });
    }
    currentDist += totalSeg;
  }

  // High intensity center line
  _utilityGfx.moveTo(x1, y1).lineTo(x2, y2)
    .stroke({ color: 0xaaffbb, width: 1.0, alpha: 0.90 * pulse, cap: "round" });

  // Contact glint sparkle
  const sparkR = Math.max(1, 4 + Math.sin(phase * 4) * 2);
  _utilityGfx.circle(x2, y2, sparkR * 2.0).fill({ color: 0x00cc3c, alpha: pulse * pulse * 0.45 })
    .circle(x2, y2, sparkR * 0.8).fill({ color: 0xffffff, alpha: pulse * pulse * 0.9 });
}

function drawTractorBeam(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  phase: number,
  active: boolean,
  tooHeavy: boolean,
  tightness: number
) {
  if (!_utilityGfx) return;
  const pulse = 0.7 + 0.3 * Math.sin(phase * 3.0);

  if (tooHeavy && !active) {
    // Weak red dashed beam (cannot pull)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const totalSeg = 20;
    let currentDist = 0;
    while (currentDist < len) {
      const nextDash = Math.min(len, currentDist + 8);
      _utilityGfx.moveTo(x1 + nx * currentDist, y1 + ny * currentDist)
        .lineTo(x1 + nx * nextDash, y1 + ny * nextDash)
        .stroke({ color: 0xff4422, width: 6.0, alpha: 0.25, cap: "round" });
      currentDist += totalSeg;
    }
  } else {
    const beamScale = 0.6 + tightness * 0.8;

    // Outer glow
    _utilityGfx.moveTo(x1, y1).lineTo(x2, y2)
      .stroke({ color: 0x00ccff, width: 12 * beamScale, alpha: 0.18 * pulse, cap: "round" });

    // Core dashed line (pulling from target to player)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const dashLen = 12;
    const gapLen = 8;
    const totalSeg = dashLen + gapLen;
    const offset = (phase * 14) % totalSeg;
    
    let currentDist = offset < 0 ? offset + totalSeg : offset;
    while (currentDist < len) {
      const nextDash = Math.min(len, currentDist + dashLen);
      if (currentDist >= 0) {
        _utilityGfx.moveTo(x1 + nx * currentDist, y1 + ny * currentDist)
          .lineTo(x1 + nx * nextDash, y1 + ny * nextDash)
          .stroke({ color: 0x44ddff, width: 2.5 * beamScale, alpha: 0.62 * pulse, cap: "round" });
      }
      currentDist += totalSeg;
    }

    // Bright center line
    _utilityGfx.moveTo(x1, y1).lineTo(x2, y2)
      .stroke({ color: 0xccf8ff, width: 1.0 * beamScale, alpha: 0.88 * pulse, cap: "round" });

    // Glow at target contact point
    const sparkR = Math.max(1, (5 + Math.sin(phase * 3.5) * 2) * 2 * beamScale);
    _utilityGfx.circle(x2, y2, sparkR).fill({ color: 0x00b4ff, alpha: pulse * pulse * 0.45 })
      .circle(x2, y2, sparkR * 0.4).fill({ color: 0xffffff, alpha: pulse * pulse * 0.90 });
  }
}
