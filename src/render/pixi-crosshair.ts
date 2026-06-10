import type { RenderSubsystem } from "./lifecycle.js";
import { Graphics } from "pixi.js";
import { Client, AppMode } from "../state.js";;
import { getThemeColors } from "../data/settings.js";
import { effectLayer, worldContainer } from "../pixi.js";

let crosshairGfx: Graphics | null = null;

function ensureCrosshair(): Graphics | null {
  const layer = effectLayer ?? worldContainer;
  if (!layer) return null;
  if (!crosshairGfx) {
    crosshairGfx = new Graphics();
    crosshairGfx.label = "crosshair";
    layer.addChild(crosshairGfx);
  } else if (!crosshairGfx.parent) {
    layer.addChild(crosshairGfx);
  }
  return crosshairGfx;
}

const _hexCache = new Map<string, number>();
function hexStringToNumber(color: string): number {
  const hit = _hexCache.get(color);
  if (hit !== undefined) return hit;
  const clean = color.startsWith("#") ? color.slice(1) : color;
  const parsed = Number.parseInt(clean, 16);
  const val = Number.isNaN(parsed) ? 0xffffff : parsed;
  _hexCache.set(color, val);
  return val;
}

function drawReticleStyle(g: Graphics, style: string, sz: number, color: number, lineWidth: number): void {
  const stroke = (alpha = 1) => g.stroke({ color, width: lineWidth, alpha });

  switch (style) {
    case "classic": {
      g.moveTo(-sz, 0).lineTo(sz, 0);
      g.moveTo(0, -sz).lineTo(0, sz);
      stroke();
      g.circle(0, 0, sz * 0.6);
      stroke();
      break;
    }

    case "cross": {
      g.moveTo(-sz, 0).lineTo(sz, 0);
      g.moveTo(0, -sz).lineTo(0, sz);
      stroke();
      break;
    }

    case "brackets": {
      const arm = sz * 0.5;
      const corners: Array<[number, number]> = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
      ];
      for (const [sx, sy] of corners) {
        g.moveTo(sx * sz, sy * sz - sy * arm)
          .lineTo(sx * sz, sy * sz)
          .lineTo(sx * sz - sx * arm, sy * sz);
      }
      stroke();
      break;
    }

    case "dot": {
      g.circle(0, 0, 1.8).fill({ color }).stroke({ color, width: lineWidth });
      const inner = sz * 0.45;
      const outer = sz * 0.8;
      g.moveTo(-outer, 0).lineTo(-inner, 0);
      g.moveTo(inner, 0).lineTo(outer, 0);
      g.moveTo(0, -outer).lineTo(0, -inner);
      g.moveTo(0, inner).lineTo(0, outer);
      stroke();
      break;
    }

    case "diamond": {
      g.circle(0, 0, 1.5).fill({ color });
      g.moveTo(-sz, 0)
        .lineTo(0, -sz)
        .lineTo(sz, 0)
        .lineTo(0, sz)
        .lineTo(-sz, 0);
      stroke();
      break;
    }

    case "chevrons": {
      const gap = sz * 0.4;
      const len = sz * 0.45;
      const chevs: Array<[number, number]> = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
      ];
      for (const [sx, sy] of chevs) {
        g.moveTo(sx * (gap + len), sy * gap)
          .lineTo(sx * gap, sy * gap)
          .lineTo(sx * gap, sy * (gap + len));
      }
      stroke();
      break;
    }

    case "delta": {
      const gap = sz * 0.35;
      const len = sz * 0.65;
      const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
      for (const angle of angles) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        g.moveTo(cos * (gap + len), sin * (gap + len)).lineTo(cos * gap, sin * gap);
        const tx = -sin * sz * 0.25;
        const ty = cos * sz * 0.25;
        g.moveTo(cos * (gap + len) - tx, sin * (gap + len) - ty)
          .lineTo(cos * (gap + len) + tx, sin * (gap + len) + ty);
      }
      stroke();
      break;
    }

    case "ring": {
      g.circle(0, 0, sz * 0.65);
      stroke();
      const r1 = sz * 0.65;
      const r2 = sz * 0.95;
      g.moveTo(-r2, 0).lineTo(-r1, 0);
      g.moveTo(r1, 0).lineTo(r2, 0);
      g.moveTo(0, -r2).lineTo(0, -r1);
      g.moveTo(0, r1).lineTo(0, r2);
      stroke();
      break;
    }

    case "hex": {
      g.circle(0, 0, 1.2).fill({ color });
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const hx = Math.cos(angle) * sz;
        const hy = Math.sin(angle) * sz;
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();
      stroke();
      break;
    }

    case "radar": {
      g.circle(0, 0, sz * 0.3);
      stroke();
      g.arc(0, 0, sz * 0.8, -Math.PI / 4, Math.PI / 4);
      g.arc(0, 0, sz * 0.8, (3 * Math.PI) / 4, (5 * Math.PI) / 4);
      stroke();
      g.moveTo(-sz * 0.2, 0).lineTo(-sz * 0.05, 0);
      g.moveTo(sz * 0.05, 0).lineTo(sz * 0.2, 0);
      stroke();
      break;
    }

    default: {
      g.moveTo(-sz, 0).lineTo(sz, 0);
      g.moveTo(0, -sz).lineTo(0, sz);
      stroke();
      break;
    }
  }
}

export function syncPixiCrosshair(): void {
  const gfx = ensureCrosshair();
  if (!gfx) return;

  const { x, y } = Client.mouseWorld;
  const sz = 12 / Client.zoom;
  const theme = getThemeColors(Client.settings?.theme || "default");
  const style = Client.settings?.reticleStyle || "classic";
  const lineWidth = 1.5 / Client.zoom;
  const colorNum = hexStringToNumber(theme.textMain || "#ffffff");

  gfx.clear();
  gfx.alpha = 0.55;
  gfx.position.set(x, y);
  drawReticleStyle(gfx, style, sz, colorNum, lineWidth);
}

export function destroyPixiCrosshair(): void {
  crosshairGfx?.destroy();
  crosshairGfx = null;
}


export const crosshairRenderer: RenderSubsystem = {
  name: "crosshair",
  sync: (ctx) => {
    syncPixiCrosshair();
  },
  destroy: destroyPixiCrosshair,
  modes: [AppMode.SPACE],
  order: 270,
};
