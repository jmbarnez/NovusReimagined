import { getState } from "../../state-access.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { SECTOR_OUTER_RADIUS } from "../../world-gen.js";

export function drawWorldBorder() {
  const state = getState();
  const pr = Math.hypot(state.player.x, state.player.y);
  const distToEdge = SECTOR_OUTER_RADIUS - pr;
  const fadeStart = 1800;
  const fadeEnd = 600;
  if (distToEdge > fadeStart) return;

  const t = Math.min(1, (fadeStart - distToEdge) / (fadeStart - fadeEnd));
  const alpha = t * 0.18;
  const pulse = 0.92 + 0.08 * Math.sin(performance.now() * 0.0018);

  ctx.save();
  ctx.globalAlpha = alpha * pulse;
  ctx.strokeStyle = "#2a4560";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.arc(0, 0, SECTOR_OUTER_RADIUS, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // Very faint inner warning band
  ctx.globalAlpha = alpha * 0.35 * pulse;
  ctx.strokeStyle = "#1a3048";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, SECTOR_OUTER_RADIUS - 120, 0, TAU);
  ctx.stroke();

  ctx.restore();
}
