import type { RenderSubsystem } from "./lifecycle.js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Client, AppMode } from "../state.js";;
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import {
  TUTORIAL_BOOST_GATES,
  gatePillarPositions,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";
import { getTutorialGateCooldown } from "../physics/tutorial-track.js";
import { getUIFont } from "./ui-font.js";

const TAU = Math.PI * 2;

/** Matches station hull palette in pixi-stations.ts */
const COL = {
  hullDark: 0x12151c,
  hullMid: 0x222832,
  hullLite: 0x384352,
  hullEdge: 0x506075,
  steelRim: 0xa0bee4,
  cyan: 0x00d2ff,
  cyanMid: 0x3c78c8,
  cyanGlow: 0x78c0ff,
  amber: 0xff9630,
};

const PYLON_R = 8;

let _gateRoot: Container | null = null;
const _gateBundles = new Map<string, GateBundle>();

interface GateBundle {
  container: Container;
  gfx: Graphics;
  hintText: Text;
  hintBg: Graphics;
}

const _hintStyle = new TextStyle({
  fontFamily: getUIFont(),
  fontSize: 10,
  fontWeight: "600",
  fill: "#88c8ff",
  align: "center",
  stroke: { color: "#000000", width: 3 },
});

export function refreshTutorialGateFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.0;
  _hintStyle.fontFamily = font;
  _hintStyle.fontSize = 10 * scale;
}

function drawPillar(
  gfx: Graphics,
  x: number,
  y: number,
  active: boolean,
): void {
  const r = PYLON_R;
  
  // Outer ring - steel
  gfx.circle(x, y, r);
  gfx.stroke({ color: COL.steelRim, width: 1, alpha: active ? 0.8 : 0.4 });
  
  // Inner glow - cyan
  const innerR = r * 0.6;
  gfx.circle(x, y, innerR);
  gfx.fill({ color: active ? COL.cyanGlow : COL.cyanMid, alpha: active ? 0.4 : 0.2 });
  
  // Core - bright cyan
  gfx.circle(x, y, innerR * 0.5);
  gfx.fill({ color: active ? 0xffffff : COL.cyan, alpha: active ? 0.9 : 0.5 });
}

function drawGateStructure(
  gfx: Graphics,
  gate: TutorialBoostGate,
  active: boolean,
): void {
  const { left, right } = gatePillarPositions(gate);
  const ang = gate.angle;
  const nx = Math.cos(ang);
  const ny = Math.sin(ang);

  drawPillar(gfx, left.x, left.y, active);
  drawPillar(gfx, right.x, right.y, active);

  // Thin elegant connection line
  gfx.moveTo(left.x, left.y);
  gfx.lineTo(right.x, right.y);
  gfx.stroke({ color: COL.steelRim, width: 0.8, alpha: active ? 0.5 : 0.25 });

  // Subtle arc indicator
  const arcR = gate.halfWidth * 0.85;
  gfx.arc(gate.x, gate.y, arcR, ang + Math.PI * 0.15, ang + Math.PI * 0.85);
  gfx.stroke({ color: COL.cyanGlow, width: 0.6, alpha: active ? 0.25 : 0.1 });
}

function ensureGateBundle(gate: TutorialBoostGate): GateBundle {
  let bundle = _gateBundles.get(gate.id);
  if (bundle) return bundle;

  const container = new Container();
  container.label = `tutorial-gate-${gate.id}`;

  const gfx = new Graphics();
  gfx.label = "structure";
  container.addChild(gfx);

  const hintBg = new Graphics();
  hintBg.label = "hint-bg";
  container.addChild(hintBg);

  const hintText = new Text({ text: "", style: _hintStyle });
  hintText.anchor.set(0.5, 1);
  hintText.label = "hint";
  container.addChild(hintText);

  if (_gateRoot) _gateRoot.addChild(container);

  bundle = { container, gfx, hintText, hintBg };
  _gateBundles.set(gate.id, bundle);
  return bundle;
}

export function initPixiTutorialGates(): void {
  if (!effectLayer) return;
  if (!_gateRoot) {
    _gateRoot = new Container();
    _gateRoot.label = "tutorial-boost-gates";
    effectLayer.addChild(_gateRoot);
  }
}

export function syncPixiTutorialGates(now: number): void {
  initPixiTutorialGates();
  if (!_gateRoot) return;

  if (getState().player.sysIdx !== 0) {
    _gateRoot.visible = false;
    return;
  }

  const gates = TUTORIAL_BOOST_GATES;
  const activeIds = new Set(gates.map((g) => g.id));

  for (const [id, bundle] of _gateBundles) {
    if (!activeIds.has(id)) bundle.container.visible = false;
  }

  for (const gate of gates) {
    if (!isVisible(gate.x, gate.y, gate.halfWidth + 80)) {
      const b = _gateBundles.get(gate.id);
      if (b) b.container.visible = false;
      continue;
    }

    const bundle = ensureGateBundle(gate);
    const cd = getTutorialGateCooldown(gate.id, getState().player);
    const active = cd <= 0;
    bundle.container.visible = true;
    bundle.gfx.clear();
    drawGateStructure(bundle.gfx, gate, active);
    bundle.hintText.visible = false;
    bundle.hintBg.visible = false;
  }

  _gateRoot.visible = true;
}

export function destroyPixiTutorialGates(): void {
  for (const bundle of _gateBundles.values()) {
    bundle.container.destroy({ children: true });
  }
  _gateBundles.clear();
  _gateRoot?.destroy();
  _gateRoot = null;
}


export const tutorialGatesRenderer: RenderSubsystem = {
  name: "tutorialGates",
  sync: (ctx) => {
    syncPixiTutorialGates(ctx.now);
  },
  destroy: destroyPixiTutorialGates,
  modes: [AppMode.SPACE],
  order: 350,
};
