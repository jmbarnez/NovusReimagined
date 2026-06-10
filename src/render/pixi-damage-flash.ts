import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer, screenContainer, worldContainer } from "../pixi.js";

let flashGfx: Graphics | null = null;

function ensureFlash(): Graphics | null {
  const layer = screenContainer ?? effectLayer ?? worldContainer;
  if (!layer) return null;
  if (!flashGfx) {
    flashGfx = new Graphics();
    flashGfx.label = "damage-flash";
    layer.addChild(flashGfx);
  } else if (!flashGfx.parent) {
    layer.addChild(flashGfx);
  }
  return flashGfx;
}

export function syncPixiDamageFlash(width: number, height: number): void {
  const g = ensureFlash();
  if (!g) return;

  const sGlow = getState().player.shieldHitGlow || 0;
  const hGlow = getState().player.hullHitGlow || 0;
  const strGlow = getState().player.structureHitGlow || 0;
  const dmgFlash = Math.max(sGlow, hGlow, strGlow);
  if (dmgFlash <= 0) { g.clear(); return; }

  let flashColor: string;
  if (strGlow > 0) flashColor = "#ee1c1c";
  else if (hGlow > 0) flashColor = "#ee9944";
  else flashColor = "#44ccff";

  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.hypot(width, height);
  const innerR = diag * 0.32;
  const outerR = diag * 0.55;

  g.clear();
  g.circle(cx, cy, outerR)
    .fill({ color: flashColor, alpha: dmgFlash * 0.28 })
    .circle(cx, cy, innerR)
    .fill({ color: flashColor, alpha: 0 });
}

export function destroyPixiDamageFlash(): void {
  flashGfx?.destroy();
  flashGfx = null;
}


export const damageFlashRenderer: RenderSubsystem = {
  name: "damageFlash",
  sync: (ctx) => {
    syncPixiDamageFlash(ctx.width, ctx.height);
  },
  destroy: destroyPixiDamageFlash,
  modes: [AppMode.SPACE],
  order: 220,
};
