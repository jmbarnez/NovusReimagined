import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { ctx } from "../../canvas.js";
import { LOCK_RAIL_H, HUD_BOTTOM_H } from "../../constants.js";
import { viewCenterX, viewCenterY } from "../viewport.js";
import { dst } from "../../utils/math.js";
import { curSys } from "../../utils/game.js";
import { ensureLockQueue } from "../../targeting.js";
import { getUIFont } from "../ui-font.js";
import { getTutorialGuideTarget } from "../pixi-tutorial-markers.js";

const edgesScratch = new Float64Array(4);

export function drawTargetArrow(Wc: number, Hc: number, camxR: number, camyR: number, now: number) {
  const sys = curSys();
  const state = getState();
  const player = state.player;
  if (!player || !sys) return;
  const zoom = Client.zoom;
  const cx = viewCenterX(Wc), cy = viewCenterY(Hc);
  const mL = 30, mR = 10, mT = LOCK_RAIL_H + 10, mB = HUD_BOTTOM_H + 10;

  // Returns screen-edge position for a world point, or null if on-screen.
  function edgePos(wx: number, wy: number): [number, number, number] | null {
    const sx = cx + (wx - camxR) * zoom;
    const sy = cy + (wy - camyR) * zoom;
    if (sx > mL && sx < Wc - mR && sy > mT && sy < Hc - mB) return null;
    const angle = Math.atan2(sy - cy, sx - cx);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    let ec = 0;
    if (cosA > 0.001) edgesScratch[ec++] = (Wc - mR - cx) / cosA;
    if (cosA < -0.001) edgesScratch[ec++] = (mL - cx) / cosA;
    if (sinA > 0.001) edgesScratch[ec++] = (Hc - mB - cy) / sinA;
    if (sinA < -0.001) edgesScratch[ec++] = (mT - cy) / sinA;
    if (!ec) return null;
    let t = Infinity;
    for (let i = 0; i < ec; i++) if (edgesScratch[i] > 0 && edgesScratch[i] < t) t = edgesScratch[i];
    if (t === Infinity) return null;
    return [cx + cosA * t, cy + sinA * t, angle];
  }

  function drawArrow(
    px: number, py: number, angle: number, fill: string, alpha: number, outlined: boolean,
    distStr?: string, shieldPct?: number, hullPct?: number,
  ) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    if (outlined) {
      // Outer ring, offset from tip — marks "you have a lock on this"
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath();
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = Math.min(alpha, 1) * 0.45;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-6, -5.5); ctx.lineTo(-6, 5.5); ctx.closePath();
    ctx.fillStyle = fill;
    ctx.globalAlpha = alpha;
    ctx.fill();

    // Draw status sub-ticks next to arrow if provided
    if (shieldPct !== undefined || hullPct !== undefined) {
      ctx.globalAlpha = alpha * 0.7;
      const barL = 12;
      const barX = -20;

      // Shield status line (top)
      if (shieldPct !== undefined && shieldPct > 0) {
        ctx.strokeStyle = "rgba(68, 204, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(barX, -4);
        ctx.lineTo(barX + barL * shieldPct, -4);
        ctx.stroke();
      }

      // Hull status line (bottom)
      if (hullPct !== undefined) {
        ctx.strokeStyle = "rgba(238, 153, 68, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(barX, -2);
        ctx.lineTo(barX + barL * hullPct, -2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Draw distance/telemetry text labels upright (unrotated) in screen space
    if (distStr) {
      ctx.save();
      ctx.font = `8px ${getUIFont()}`;
      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha * 0.85;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Position the label slightly offset from the boundary arrow toward the center
      const dx = px - cx;
      const dy = py - cy;
      const dMag = Math.hypot(dx, dy) || 1;
      const tx = px - (dx / dMag) * 22;
      const ty = py - (dy / dMag) * 22;

      ctx.fillText(distStr, tx, ty);
      ctx.restore();
    }
  }

  // Collect your resolved locks for quick lookup
  const lockedIds = new Set<string>();
  ensureLockQueue(getState().player);
  for (const slot of player.lockQueue) {
    if (!slot.resolving) lockedIds.add(slot.id);
  }

  const flash = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.006));

  // Enemy arrows — one per off-screen enemy with any relevance
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const youLocked = lockedIds.has(e.id);
    const theyLocked = !!e.hasLockOnPlayer;
    const theyLocking = !!e.targetingPlayer && !theyLocked;
    if (!youLocked && !theyLocked && !theyLocking) continue;
    const pos = edgePos(e.x, e.y);
    if (!pos) continue;
    const fill = theyLocked ? "#ff3333" : theyLocking ? "#ffdd44" : "#ff6666";
    const alpha = theyLocked ? 1.0 : theyLocking ? flash : 0.75;

    // Calculate dynamic distance telemetry
    const d = Math.round(dst(player.x, player.y, e.x, e.y));
    const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;

    // Calculate target stats percentages
    const maxShield = e.maxShield || 0;
    const shieldPct = maxShield > 0 ? (e.shield || 0) / maxShield : 0;
    const hullPct = Math.max(0, Math.min(1, (e.hp || 0) / Math.max(1, e.maxHp)));

    drawArrow(pos[0], pos[1], pos[2], fill, alpha, youLocked, distStr, shieldPct, hullPct);
  }

  // Locked asteroids off-screen — blue outlined arrow
  for (const slot of player.lockQueue) {
    if (slot.resolving) continue;
    const a = sys.asteroids.find((a2) => a2.id === slot.id && !a2.depleted && a2.hp > 0);
    if (!a) continue;
    const pos = edgePos(a.x, a.y);
    if (pos) {
      const d = Math.round(dst(player.x, player.y, a.x, a.y));
      const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;
      const hullPct = Math.max(0, Math.min(1, (a.hp || 0) / Math.max(1, a.maxHp)));
      drawArrow(pos[0], pos[1], pos[2], "#88aaff", 0.75, true, distStr, undefined, hullPct);
    }
  }
}

/** Off-screen guide arrow toward the active tutorial step. */
export function drawTutorialGuideArrow(Wc: number, Hc: number, camxR: number, camyR: number, now: number) {
  const state = getState();
  const player = state.player;
  if (!player?.tutorial?.active) return;

  const target = getTutorialGuideTarget();
  if (!target) return;

  const zoom = Client.zoom;
  const cx = viewCenterX(Wc), cy = viewCenterY(Hc);
  const mL = 30, mR = 10, mT = LOCK_RAIL_H + 10, mB = HUD_BOTTOM_H + 10;
  const sx = cx + (target.x - camxR) * zoom;
  const sy = cy + (target.y - camyR) * zoom;
  if (sx > mL && sx < Wc - mR && sy > mT && sy < Hc - mB) return;

  const angle = Math.atan2(sy - cy, sx - cx);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  let t = Infinity;
  const edges = [0, 0, 0, 0];
  let ec = 0;
  if (cosA > 0.001) edges[ec++] = (Wc - mR - cx) / cosA;
  if (cosA < -0.001) edges[ec++] = (mL - cx) / cosA;
  if (sinA > 0.001) edges[ec++] = (Hc - mB - cy) / sinA;
  if (sinA < -0.001) edges[ec++] = (mT - cy) / sinA;
  for (let i = 0; i < ec; i++) if (edges[i] > 0 && edges[i] < t) t = edges[i];
  if (t === Infinity) return;

  const px = cx + cosA * t;
  const py = cy + sinA * t;
  const pulse = 0.65 + 0.35 * Math.abs(Math.sin(now * 0.005));

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fillStyle = "#ffdd44";
  ctx.globalAlpha = pulse * 0.85;
  ctx.fill();
  ctx.restore();
}
