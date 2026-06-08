import { MODULES } from "../../data/modules.js";
import { resolveIcon } from "./icon-resolver.js";
import { drawCastShadow, drawIconBackdrop, ICON_SUBJECT_SCALE, type IconPaintCtx } from "./painters/shared.js";

function buildPaintCtx(cx: CanvasRenderingContext2D, id: string, half: number): IconPaintCtx {
  const resolved = resolveIcon(id);
  const mod = MODULES[id];
  return {
    cx,
    half,
    accent: resolved.accent,
    isCivilian: resolved.isCivilian,
    rack: mod?.rack,
  };
}

function drawSubject(cx: CanvasRenderingContext2D, id: string, half: number): void {
  const paintCtx = buildPaintCtx(cx, id, half);
  cx.save();
  cx.translate(half, half);
  cx.scale(ICON_SUBJECT_SCALE, ICON_SUBJECT_SCALE);
  cx.translate(-half, -half);
  const resolved = resolveIcon(id);
  resolved.painter(paintCtx);
  cx.restore();
}

/** Draw one catalog icon into any Canvas2D context (browser or Node bake). */
export function paintItemIcon(cx: CanvasRenderingContext2D, id: string, logicalSize: number): void {
  const half = logicalSize / 2;
  const paintCtx = buildPaintCtx(cx, id, half);
  drawCastShadow(paintCtx);
  drawSubject(cx, id, half);
}

/** Draw only the subject art (no backdrop / shadow / frame). */
export function paintItemIconSubjectOnly(cx: CanvasRenderingContext2D, id: string, logicalSize: number): void {
  drawSubject(cx, id, logicalSize / 2);
}
