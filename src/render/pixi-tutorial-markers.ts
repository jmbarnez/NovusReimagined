import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import {
  getCurrentTutorialStep,
  tutorialGatePulse,
  isTrainingSiteResolved,
  getTrainingSite,
} from "../data/tutorial.js";
import { TUTORIAL_TRAINING_SITE_X, TUTORIAL_TRAINING_SITE_Y, TUTORIAL_GATE } from "../data/tutorial-layout.js";
import { isTutorialExitGateRevealed } from "../data/tutorial.js";

const TAU = Math.PI * 2;
let _beaconGfx: Graphics | null = null;
let _lastStep = -1;

export function initPixiTutorialMarkers() {
  if (_beaconGfx || !effectLayer) return;
  _beaconGfx = new Graphics();
  _beaconGfx.label = "tutorial-beacons";
  effectLayer.addChild(_beaconGfx);
}

export function syncPixiTutorialMarkers(now: number) {
  if (!_beaconGfx) initPixiTutorialMarkers();
  if (!_beaconGfx) return;

  _beaconGfx.clear();

  if (!getState().player?.tutorial?.active) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;

  if (_lastStep !== getState().player.tutorial.step) {
    _lastStep = getState().player.tutorial.step;
  }

  // Map-only steps — no world beacon column
  if (step.id === "scan-signature") return;

  const guide = getTutorialGuideTarget();
  if (!guide) return;
  const { x, y } = guide;
  const r = step.id === "fly-gate" || step.id === "graduation" ? 90 : step.zone.r;
  if (!isVisible(x, y, r + 120)) return;

  const pulse = 0.55 + 0.45 * Math.sin(now * 0.003);
  const color = step.beaconColor;

  _beaconGfx.circle(x, y, r * (0.85 + pulse * 0.08))
    .stroke({ color, width: 2, alpha: 0.35 + pulse * 0.25 });

  _beaconGfx.circle(x, y, r * 0.35)
    .fill({ color, alpha: 0.08 + pulse * 0.06 });

  const colH = 180 + pulse * 40;
  _beaconGfx.rect(x - 8, y - colH, 16, colH)
    .fill({ color, alpha: 0.06 + pulse * 0.05 });

  _beaconGfx.moveTo(x, y - colH)
    .lineTo(x - 14, y - colH * 0.55)
    .lineTo(x + 14, y - colH * 0.55)
    .closePath()
    .fill({ color, alpha: 0.12 + pulse * 0.08 });
}

export function drawTutorialGatePulse(ctx2d: CanvasRenderingContext2D, now: number, sys: import("../types/world.js").System) {
  if (!getState().player?.tutorial?.active || tutorialGatePulse <= 0 || !isTutorialExitGateRevealed(getState().player)) return;
  const step = getCurrentTutorialStep(getState().player);
  if (step?.id !== "fly-gate" && step?.id !== "graduation") return;
  const gate = sys.gates.find((g) => g.x === TUTORIAL_GATE.x && g.y === TUTORIAL_GATE.y) ?? sys.gates[0];
  if (!gate) return;

  const pulse = tutorialGatePulse * (0.7 + 0.3 * Math.sin(now * 0.005));
  ctx2d.save();
  ctx2d.globalAlpha = pulse * 0.55;
  ctx2d.strokeStyle = "#ffffff";
  ctx2d.lineWidth = 3;
  ctx2d.beginPath();
  ctx2d.arc(gate.x, gate.y, gate.radius + 20 + pulse * 15, 0, TAU);
  ctx2d.stroke();
  ctx2d.restore();
}

export function getTutorialGuideTarget(): { x: number; y: number } | null {
  if (!getState().player?.tutorial?.active) return null;
  const step = getCurrentTutorialStep(getState().player);
  if (!step) return null;

  if (step.id === "fly-gate" || step.id === "graduation") {
    return { x: TUTORIAL_GATE.x, y: TUTORIAL_GATE.y };
  }

  if (step.id === "fly-signature" || step.id === "breach-signature") {
    if (isTrainingSiteResolved(getState().player)) {
      const site = getTrainingSite();
      if (site) return { x: site.x, y: site.y };
    }
    return { x: TUTORIAL_TRAINING_SITE_X, y: TUTORIAL_TRAINING_SITE_Y };
  }

  if (step.nav) {
    return { x: step.nav.targetX, y: step.nav.targetY };
  }

  return { x: step.zone.x, y: step.zone.y };
}

export function destroyPixiTutorialMarkers() {
  _beaconGfx?.destroy();
  _beaconGfx = null;
  _lastStep = -1;
}
