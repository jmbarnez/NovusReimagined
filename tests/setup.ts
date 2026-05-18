// DOM setup for Vitest (jsdom environment)
// Canvas and other required elements must exist before modules load.

const canvas = document.createElement("canvas");
canvas.id = "c";
document.body.appendChild(canvas);

// jsdom's getContext("2d") returns null without a native canvas package.
// Provide a minimal mock so canvas.ts can initialize at import time.
const noop = () => {};
function createMockCtx(): any {
  return {
    setTransform: noop,
    resetTransform: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    drawImage: noop,
    putImageData: noop,
    getImageData: noop,
    createLinearGradient: (): { addColorStop: () => void } => ({ addColorStop: noop }),
    createRadialGradient: (): { addColorStop: () => void } => ({ addColorStop: noop }),
    createPattern: (): null => null,
    measureText: (): { width: number } => ({ width: 0 }),
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    getLineDash: (): number[] => [],
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    strokeStyle: "#000",
    fillStyle: "#000",
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    direction: "ltr",
    canvas,
  };
}

const origGetContext = (HTMLCanvasElement.prototype as any).getContext;
(HTMLCanvasElement.prototype as any).getContext = function (type: string, _opts?: any) {
  if (type === "2d") {
    return createMockCtx();
  }
  return origGetContext.call(this, type, _opts);
};
