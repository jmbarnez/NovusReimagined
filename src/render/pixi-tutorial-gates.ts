import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import {
  TUTORIAL_BOOST_GATES,
  getActiveTutorialTracks,
  gatePillarPositions,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";

let _gatesGfx: Graphics | null = null;

function getActiveBoostGates(stepId: string): TutorialBoostGate[] {
  const activeTrackIds = new Set(getActiveTutorialTracks(stepId).map((t: { id: string }) => t.id));
  return TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => activeTrackIds.has(g.trackId));
}

function drawGate(gfx: Graphics, gate: TutorialBoostGate, now: number): void {
  const [a, b] = gatePillarPositions(gate);
  if (!isVisible(gate.x, gate.y, gate.halfWidth + 120)) return;

  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now * 0.005));
  const color = 0x55aaff;

  // Energy arc between pillars
  gfx.moveTo(a.x, a.y);
  gfx.lineTo(b.x, b.y);
  gfx.stroke({ color, width: 2 + pulse * 2, alpha: 0.25 + pulse * 0.25 });

  // Pillar caps
  const capSize = 10;
  for (const p of [a, b]) {
    gfx.circle(p.x, p.y, capSize)
      .fill({ color, alpha: 0.5 + pulse * 0.3 });
    gfx.circle(p.x, p.y, capSize * 0.5)
      .fill({ color: 0xffffff, alpha: 0.4 + pulse * 0.3 });
  }
}

export function refreshTutorialGateFonts(): void {
  // No-op: boost gates use simple Pixi shapes, no text.
}

export function initPixiTutorialGates(): void {
  if (!effectLayer) return;
  if (!_gatesGfx) {
    _gatesGfx = new Graphics();
    _gatesGfx.label = "tutorial-boost-gates";
    effectLayer.addChild(_gatesGfx);
  }
}

export function syncPixiTutorialGates(now: number): void {
  initPixiTutorialGates();
  if (!_gatesGfx) return;

  _gatesGfx.clear();

  const player = getState().player;
  if (!player?.tutorial?.active || player.sysIdx !== 0) {
    _gatesGfx.visible = false;
    return;
  }

  const step = getCurrentTutorialStep(player);
  const activeGates = step ? getActiveBoostGates(step.id) : [];
  if (activeGates.length === 0) {
    _gatesGfx.visible = false;
    return;
  }

  _gatesGfx.visible = true;
  for (const gate of activeGates) {
    drawGate(_gatesGfx, gate, now);
  }
}
