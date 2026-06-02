import { MODULES } from "../../data/modules.js";
import { resolveIcon } from "./icon-resolver.js";
import { drawCastShadow, drawIconBackdrop, ICON_SUBJECT_SCALE, type IconPaintCtx } from "./painters/shared.js";

/** Draw one catalog icon into any Canvas2D context (browser or Node bake). */
export function paintItemIcon(cx: CanvasRenderingContext2D, id: string, logicalSize: number): void {
  const half = logicalSize / 2;
  const resolved = resolveIcon(id);
  const mod = MODULES[id];
  const paintCtx: IconPaintCtx = {
    cx,
    half,
    accent: resolved.accent,
    isCivilian: resolved.isCivilian,
    rack: mod?.rack,
  };
  drawIconBackdrop(paintCtx);
  drawCastShadow(paintCtx);
  cx.save();
  cx.translate(half, half);
  cx.scale(ICON_SUBJECT_SCALE, ICON_SUBJECT_SCALE);
  cx.translate(-half, -half);
  resolved.painter(paintCtx);
  cx.restore();
}
