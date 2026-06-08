/**
 * Utility beam rendering (mining laser, salvager beam, tractor beam).
 */
import { Graphics } from "pixi.js";
import { getState } from "../../state-access.js";
import {
  getRenderedPlayerTurretOrigin,
} from "../../combat/turret-origin.js";
import { getSalvagerBeam } from "../../salvager.js";
import { getTractorBeam } from "../../tractor.js";

let _currentNow = 0;
let _utilityGfx: Graphics | null = null;

export function setUtilityGraphics(gfx: Graphics): void {
  _utilityGfx = gfx;
}

export function syncUtilityBeams(now: number, alpha: number): void {
  if (!_utilityGfx) return;
  _utilityGfx.clear();
  _currentNow = now;

  const state = getState();
  const beamOrigin = state.player ? getRenderedPlayerTurretOrigin(alpha, state.player) : null;

  // Local player beams
  const localPlayer = state.player;
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
  if (state.players) {
    const localNetId = state.player?.netId;
    for (const p of state.players.values()) {
      if (p.netId && p.netId === localNetId) continue;
      const pOrigin = getRenderedPlayerTurretOrigin(alpha, p);

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

  // Contact point — intensified weld pool + denser micro-sparks
  if (hittingAsteroid) {
    const flicker = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((phase || 0) * 3.2));
    const backA = Math.atan2(-hitNy, -hitNx);

    _utilityGfx.circle(endX, endY, 12).fill({ color: 0xffa020, alpha: flicker * 0.38 });
    _utilityGfx.circle(endX, endY, 7).fill({ color: 0xffcc44, alpha: flicker * 0.60 });
    _utilityGfx.circle(endX, endY, 3).fill({ color: 0xffffff, alpha: flicker * 0.95 });
    _utilityGfx.circle(endX, endY, 15).fill({ color: 0xff8800, alpha: flicker * 0.15 });
    _utilityGfx.circle(endX, endY, 9).stroke({ color: 0xffe090, width: 1.3, alpha: flicker * 0.50 });

    for (let s = 0; s < 6; s++) {
      const gate = 0.5 + 0.5 * Math.sin((phase || 0) * (3.5 + s * 0.9) + s * 1.9);
      if (gate < 0.5) continue;
      const side = s % 2 === 0 ? 1 : -1;
      const sa = backA + side * (0.4 + gate * 0.6) + Math.sin((phase || 0) * (2 + s)) * 0.35;
      const len = 5 + gate * 16;
      _utilityGfx.moveTo(endX, endY)
        .lineTo(endX + Math.cos(sa) * len, endY + Math.sin(sa) * len)
        .stroke({ color: 0xffe8a0, width: 0.85, alpha: gate * 0.80, cap: "round" });
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
