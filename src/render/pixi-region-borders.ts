import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/tutorial-layout.js";

const TAU = Math.PI * 2;

let _regionGfx: Graphics | null = null;

function regionActiveForStep(regId: string, activeStepId: string | undefined): boolean {
  if (!activeStepId) return false;
  switch (activeStepId) {
    case "fly-mining":
    case "targeting":
    case "mining":
      return regId === "tut-mining";
    case "fly-academy":
    case "fly-station":
    case "industry":
      return regId === "tut-industry" || regId === "tut-flight";
    case "fly-gunnery":
    case "gunnery":
      return regId === "tut-gunnery";
    case "scan-signature":
    case "fly-signature":
    case "breach-signature":
      return regId === "tut-signature";
    default:
      return false;
  }
}

function drawDashedCircle(gfx: Graphics, cx: number, cy: number, radius: number, segments: number, dashRatio: number, color: number, alpha: number, width: number): void {
  for (let i = 0; i < segments; i++) {
    if (i % 2 !== 0) continue;
    const a0 = (i / segments) * TAU;
    const a1 = ((i + dashRatio) / segments) * TAU;
    gfx.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
    gfx.arc(cx, cy, radius, a0, a1);
    gfx.stroke({ color, width, alpha });
  }
}

export function initPixiRegionBorders(): void {
  if (_regionGfx || !effectLayer) return;
  _regionGfx = new Graphics();
  _regionGfx.label = "tutorial-region-borders";
  effectLayer.addChild(_regionGfx);
}

export function syncPixiRegionBorders(now: number): void {
  if (!_regionGfx) initPixiRegionBorders();
  if (!_regionGfx) return;

  _regionGfx.clear();

  if (!getState().player?.tutorial?.active || getState().player.sysIdx !== 0) {
    _regionGfx.visible = false;
    return;
  }

  const activeStep = getCurrentTutorialStep(getState().player);
  const activeStepId = activeStep?.id;

  for (const reg of TUTORIAL_LOCAL_REGIONS) {
    if (!isVisible(reg.x, reg.y, reg.r + 80)) continue;
    const isActive = regionActiveForStep(reg.id, activeStepId);
    const alpha = isActive ? 0.22 + 0.06 * Math.sin(now * 0.003) : 0.14;
    drawDashedCircle(_regionGfx, reg.x, reg.y, reg.r, 72, 0.55, 0x6496c8, alpha, 1.5);
  }
  _regionGfx.visible = true;
}

export function destroyPixiRegionBorders(): void {
  _regionGfx?.destroy();
  _regionGfx = null;
}
