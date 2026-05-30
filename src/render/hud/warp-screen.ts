import { getState } from "../../state-access.js";
import { ctx } from "../../canvas.js";
import { getUIFont } from "../ui-font.js";
import { mulberry32 } from "../../utils/math.js";

// Pre-computed stable streak data — same every warp, animation driven by progress
const _STREAKS = (() => {
  const rng = mulberry32(0xBEEF1234);
  return Array.from({ length: 130 }, () => ({
    a:  rng() * Math.PI * 2,
    sp: 0.22 + rng() * 0.78,
    lm: 0.45 + rng() * 0.55,
    ir: 5    + rng() * 22,
    w:  0.3  + rng() * 1.6,
    br: 0.45 + rng() * 0.55,
  }));
})();

export function drawWarpScreen(Wc: number, Hc: number, now: number) {
  const state = getState();
  const player = state.player;
  const preWarp = state.warpTargetIdx >= 0;
  const cx = Wc / 2, cy = Hc / 2;
  const halfDiag = Math.hypot(Wc, Hc) * 0.5;

  let progress: number, arrFade: number;
  if (preWarp) {
    progress = Math.max(0, 1 - state.warpCooldown / 2.4);
    arrFade = 0;
  } else {
    progress = 1;
    arrFade = Math.min(1, (state.warpCooldown - 2.0) / 0.5);
  }

  // Deep space overlay — darkens as warp builds
  const overlayA = preWarp
    ? Math.min(0.92, 0.15 + progress * 0.82)
    : Math.max(0, arrFade) * 0.7;
  ctx.fillStyle = `rgba(0,1,10,${overlayA})`;
  ctx.fillRect(0, 0, Wc, Hc);

  if (preWarp && progress > 0.02) {
    // Streaking hyperspace lines
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of _STREAKS) {
      const len = s.lm * Math.pow(progress, 1.35) * halfDiag * s.sp;
      if (len < 3) continue;
      const alpha = s.br * Math.min(1, progress * 2) * s.sp;
      if (alpha < 0.03) continue;
      const x1 = cx + Math.cos(s.a) * s.ir;
      const y1 = cy + Math.sin(s.a) * s.ir;
      const x2 = cx + Math.cos(s.a) * (s.ir + len);
      const y2 = cy + Math.sin(s.a) * (s.ir + len);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0,    `rgba(80,130,255,0)`);
      grad.addColorStop(0.2,  `rgba(160,200,255,${alpha * 0.55})`);
      grad.addColorStop(1,    `rgba(255,255,255,${alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w * (0.4 + progress * 0.8);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();

    // Central glow bloom
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + progress * 140);
    bloom.addColorStop(0,   `rgba(140,190,255,${0.22 * progress * progress})`);
    bloom.addColorStop(0.5, `rgba(70,110,220,${0.12 * progress})`);
    bloom.addColorStop(1,   "transparent");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, Wc, Hc);

    // Edge tunnel vignette
    const vig = ctx.createRadialGradient(cx, cy, halfDiag * 0.35, cx, cy, halfDiag);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, `rgba(0,0,18,${0.75 * progress})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, Wc, Hc);
  }

  // Arrival flash
  if (arrFade > 0.01) {
    ctx.fillStyle = `rgba(170,210,255,${arrFade * 0.8})`;
    ctx.fillRect(0, 0, Wc, Hc);
  }

  // Text overlays
  const destIdx  = preWarp ? state.warpTargetIdx : player.sysIdx;
  const destSys  = state.GALAXY[destIdx];
  const destName = (destSys?.name || "").toUpperCase();
  const textA    = preWarp ? Math.min(1, (progress - 0.12) / 0.18) : arrFade;

  if (textA > 0.01) {
    ctx.save();
    ctx.globalAlpha = textA;
    ctx.textAlign = "center";

    if (preWarp) {
      ctx.font = `bold 10px ${getUIFont()}`;
      ctx.fillStyle = "#344e72";
      ctx.fillText("JUMP DRIVE ENGAGED", cx, cy - 32);

      ctx.font = `bold 24px ${getUIFont()}`;
      ctx.fillStyle = "#aaceff";
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#3366cc";
      ctx.fillText(`⟩⟩ ${destName}`, cx, cy + 6);
      ctx.shadowBlur = 0;

      if (destSys) {
        const sec = destSys.security?.toFixed(1);
        const secCol = destSys.security >= 0.7 ? "#44ff88"
                     : destSys.security >= 0.4 ? "#ffcc44" : "#ff5544";
        ctx.font = `10px ${getUIFont()}`;
        ctx.fillStyle = secCol;
        ctx.globalAlpha = textA * 0.7;
        ctx.fillText(`SECURITY ${sec}`, cx, cy + 28);
      }
    } else {
      ctx.font = `bold 20px ${getUIFont()}`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#88bbff";
      ctx.fillText(destName, cx, cy);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
