/**
 * Standalone Reticle Vector Renderer.
 * Draws high-tech targeting reticles on any 2D canvas context.
 * Used for both real-time world combat view and DOM settings preview widgets.
 */

const TAU = Math.PI * 2;

export function renderReticleStyle(
  ctx: CanvasRenderingContext2D,
  style: string,
  x: number,
  y: number,
  sz: number,
  color: string,
  lineWidth: number
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (style) {
    case "classic":
      // Plus-sign lines + center circle
      ctx.beginPath();
      ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
      ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, sz * 0.6, 0, TAU);
      ctx.stroke();
      break;

    case "cross":
      // Plus-sign lines only
      ctx.beginPath();
      ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
      ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
      ctx.stroke();
      break;

    case "brackets": {
      // Four corner framing brackets
      const arm = sz * 0.5;
      const corners = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
      ];
      for (const [sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x + sx * sz, y + sy * sz - sy * arm);
        ctx.lineTo(x + sx * sz, y + sy * sz);
        ctx.lineTo(x + sx * sz - sx * arm, y + sy * sz);
        ctx.stroke();
      }
      break;
    }

    case "dot":
      // Solid center dot + tiny outer ticks
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();

      {
        const inner = sz * 0.45;
        const outer = sz * 0.8;
        ctx.beginPath();
        ctx.moveTo(x - outer, y); ctx.lineTo(x - inner, y);
        ctx.moveTo(x + inner, y); ctx.lineTo(x + outer, y);
        ctx.moveTo(x, y - outer); ctx.lineTo(x, y - inner);
        ctx.moveTo(x, y + inner); ctx.lineTo(x, y + outer);
        ctx.stroke();
      }
      break;

    case "diamond":
      // Diamond outline + filled center dot
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x - sz, y);
      ctx.lineTo(x, y - sz);
      ctx.lineTo(x + sz, y);
      ctx.lineTo(x, y + sz);
      ctx.closePath();
      ctx.stroke();
      break;

    case "chevrons": {
      // Four corner chevron arrowheads pointing inwards
      const gap = sz * 0.4;
      const len = sz * 0.45;
      const chevs = [
        [-1, -1], [1, -1], [1, 1], [-1, 1]
      ];
      for (const [sx, sy] of chevs) {
        ctx.beginPath();
        ctx.moveTo(x + sx * (gap + len), y + sy * gap);
        ctx.lineTo(x + sx * gap, y + sy * gap);
        ctx.lineTo(x + sx * gap, y + sy * (gap + len));
        ctx.stroke();
      }
      break;
    }

    case "delta": {
      // Y-shaped three-point markers pointing inwards at 120-degree intervals
      const gap = sz * 0.35;
      const len = sz * 0.65;
      const angles = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6];
      for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Direct radial line
        ctx.beginPath();
        ctx.moveTo(x + cos * (gap + len), y + sin * (gap + len));
        ctx.lineTo(x + cos * gap, y + sin * gap);
        ctx.stroke();
        // Cross tick at outer end
        const tx = -sin * sz * 0.25;
        const ty = cos * sz * 0.25;
        ctx.beginPath();
        ctx.moveTo(x + cos * (gap + len) - tx, y + sin * (gap + len) - ty);
        ctx.lineTo(x + cos * (gap + len) + tx, y + sin * (gap + len) + ty);
        ctx.stroke();
      }
      break;
    }

    case "ring":
      // Hollow circle + four cardinal notches
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.65, 0, TAU);
      ctx.stroke();

      {
        const r1 = sz * 0.65;
        const r2 = sz * 0.95;
        ctx.beginPath();
        ctx.moveTo(x - r2, y); ctx.lineTo(x - r1, y);
        ctx.moveTo(x + r1, y); ctx.lineTo(x + r2, y);
        ctx.moveTo(x, y - r2); ctx.lineTo(x, y - r1);
        ctx.moveTo(x, y + r1); ctx.lineTo(x, y + r2);
        ctx.stroke();
      }
      break;

    case "hex":
      // Hexagon bracket + small center dot
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const hx = x + Math.cos(angle) * sz;
        const hy = y + Math.sin(angle) * sz;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      break;

    case "radar":
      // Outer sweeping arcs framing a central ring alignment
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.3, 0, TAU);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, sz * 0.8, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.8, 3 * Math.PI / 4, 5 * Math.PI / 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - sz * 0.2, y); ctx.lineTo(x - sz * 0.05, y);
      ctx.moveTo(x + sz * 0.05, y); ctx.lineTo(x + sz * 0.2, y);
      ctx.stroke();
      break;

    default:
      // Fallback to crosshair
      ctx.beginPath();
      ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
      ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
      ctx.stroke();
      break;
  }

  ctx.restore();
}
