import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer, worldContainer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import {
  getCurrentTutorialStep,
  tutorialGatePulse,
} from "../data/tutorial.js";
import { TUTORIAL_GATE } from "../data/tutorial-layout.js";
import { isTutorialExitGateRevealed } from "../data/tutorial.js";

const TAU = Math.PI * 2;
let _beaconGfx: Graphics | null = null;
let _lastStep = -1;
let _gatePulseGfx: Graphics | null = null;

export function initPixiTutorialMarkers() {
  if (_beaconGfx || !effectLayer) return;
  _beaconGfx = new Graphics();
  _beaconGfx.label = "tutorial-beacons";
  effectLayer.addChild(_beaconGfx);
}

export function syncPixiTutorialMarkers(now: number, sys: import("../types/world.js").System) {
  if (!_beaconGfx) initPixiTutorialMarkers();
  if (!_beaconGfx) return;

  _beaconGfx.clear();

  if (!getState().player?.tutorial?.active) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;

  if (_lastStep !== getState().player.tutorial.step) {
    _lastStep = getState().player.tutorial.step;
  }

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

  // Gate pulse overlay (Pixi replacement for drawTutorialGatePulse)
  if (tutorialGatePulse > 0 && isTutorialExitGateRevealed(getState().player)) {
    const gate = sys?.gates?.find((g) => g.x === TUTORIAL_GATE.x && g.y === TUTORIAL_GATE.y) ?? sys?.gates?.[0];
    const stepCurrent = getCurrentTutorialStep(getState().player);
    if (gate && (stepCurrent?.id === "fly-gate" || stepCurrent?.id === "graduation")) {
      if (!_gatePulseGfx) {
        _gatePulseGfx = new Graphics();
        _gatePulseGfx.label = "tutorial-gate-pulse";
        (effectLayer ?? worldContainer)?.addChild(_gatePulseGfx);
      }
      const pulseGate = tutorialGatePulse * (0.7 + 0.3 * Math.sin(now * 0.005));
      _gatePulseGfx.clear();
      _gatePulseGfx.circle(gate.x, gate.y, gate.radius + 20 + pulseGate * 15)
        .stroke({ color: 0xffffff, width: 3, alpha: pulseGate * 0.55 });
    }
  } else {
    _gatePulseGfx?.clear();
  }
}

export function getTutorialGuideTarget(): { x: number; y: number } | null {
  if (!getState().player?.tutorial?.active) return null;
  const step = getCurrentTutorialStep(getState().player);
  if (!step) return null;

  if (step.id === "fly-gate" || step.id === "graduation") {
    return { x: TUTORIAL_GATE.x, y: TUTORIAL_GATE.y };
  }

  if (step.nav) {
    return { x: step.nav.targetX, y: step.nav.targetY };
  }

  return { x: step.zone.x, y: step.zone.y };
}

export function destroyPixiTutorialMarkers() {
  _beaconGfx?.destroy();
  _beaconGfx = null;
  _gatePulseGfx?.destroy();
  _gatePulseGfx = null;
  _lastStep = -1;
}
