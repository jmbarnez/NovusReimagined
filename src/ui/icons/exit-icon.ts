import { ICON_LOGICAL, ICON_TEX_SCALE } from "./painters/shared.js";

const FALLBACK_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeCanvas(): { c: HTMLCanvasElement; cx: CanvasRenderingContext2D; half: number } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  const physical = ICON_LOGICAL * ICON_TEX_SCALE;
  c.width = physical;
  c.height = physical;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.scale(ICON_TEX_SCALE, ICON_TEX_SCALE);
  return { c, cx, half: ICON_LOGICAL / 2 };
}

let cachedDataUrl: string | null = null;

/** Bake a stylized power/off symbol to a PNG data URL. */
export function bakeExitIcon(accent = "#ff6644", bg = "transparent"): string {
  if (cachedDataUrl) return cachedDataUrl;

  const canvas = makeCanvas();
  if (!canvas) {
    cachedDataUrl = FALLBACK_ICON;
    return cachedDataUrl;
  }

  const { c, cx, half } = canvas;
  const size = ICON_LOGICAL;
  const center = half;
  const radius = half * 0.55;
  const lineWidth = 3.5;

  cx.clearRect(0, 0, size, size);

  if (bg !== "transparent") {
    cx.fillStyle = bg;
    cx.fillRect(0, 0, size, size);
  }

  cx.lineCap = "round";
  cx.lineJoin = "round";
  cx.strokeStyle = accent;
  cx.lineWidth = lineWidth;

  // Outer circle arc (top 270° gap at bottom)
  cx.beginPath();
  cx.arc(center, center, radius, Math.PI * 0.15, Math.PI * 0.85);
  cx.stroke();

  // Vertical stem
  cx.beginPath();
  cx.moveTo(center, center - radius * 0.35);
  cx.lineTo(center, center + radius * 0.35);
  cx.stroke();

  let dataUrl = FALLBACK_ICON;
  try {
    const baked = c.toDataURL("image/png");
    if (baked && baked.startsWith("data:image/png")) dataUrl = baked;
  } catch {
    /* jsdom / headless environments may lack toDataURL */
  }

  cachedDataUrl = dataUrl;
  return dataUrl;
}
