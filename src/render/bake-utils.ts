// Shared Canvas2D helpers for baking hull/sprite textures.

/** Trace a closed polygon path whose vertices are offset from a center point. */
export function tracePath(cx: CanvasRenderingContext2D, path: number[][], center: number) {
  cx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const [px, py] = path[i];
    i === 0 ? cx.moveTo(center + px, center + py) : cx.lineTo(center + px, center + py);
  }
  cx.closePath();
}
