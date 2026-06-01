import { Container, Graphics, Text, TextStyle } from "pixi.js";
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

const PYLON_R = 15;

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

function drawOctPlatform(
  gfx: Graphics,
  x: number,
  y: number,
  rot: number,
  active: boolean,
  pulse: number,
): void {
  // Octagon — inline moveTo/lineTo to avoid per-frame array allocation
  const r = PYLON_R;
  const base = rot + TAU / 16;
  gfx.moveTo(x + Math.cos(base) * r, y + Math.sin(base) * r);
  for (let i = 1; i < 8; i++) {
    const a = base + (i / 8) * TAU;
    gfx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  gfx.closePath();
  gfx.fill({ color: COL.hullDark, alpha: active ? 0.94 : 0.5 });
  gfx.stroke({ color: COL.hullEdge, width: 1.4, alpha: active ? 0.85 : 0.35 });

  // Steel rim (second pass, slightly different alpha)
  gfx.moveTo(x + Math.cos(base) * r, y + Math.sin(base) * r);
  for (let i = 1; i < 8; i++) {
    const a = base + (i / 8) * TAU;
    gfx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  gfx.closePath();
  gfx.stroke({ color: COL.steelRim, width: 0.7, alpha: active ? 0.45 + pulse * 0.2 : 0.15 });

  gfx.circle(x, y, 6.5);
  gfx.stroke({ color: active ? COL.cyan : COL.cyanMid, width: 0.9, alpha: active ? 0.4 + pulse * 0.35 : 0.18 });

  gfx.circle(x, y, 2.2);
  gfx.fill({ color: active ? 0x6ef0ff : 0x5080a0, alpha: active ? 0.85 : 0.35 });

  const bx = x + Math.cos(rot) * (PYLON_R * 0.62);
  const by = y + Math.sin(rot) * (PYLON_R * 0.62);
  gfx.circle(bx, by, 1.6);
  gfx.fill({ color: COL.amber, alpha: active ? 0.45 + pulse * 0.35 : 0.12 });
}

function drawLatticeStub(
  gfx: Graphics,
  x: number,
  y: number,
  rot: number,
  len: number,
  active: boolean,
): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const px = -sin;
  const py = cos;
  const w = 4.5;

  const x1 = x + cos * 4;
  const y1 = y + sin * 4;
  const x2 = x + cos * len;
  const y2 = y + sin * len;

  gfx.moveTo(x1 + px * w, y1 + py * w);
  gfx.lineTo(x2 + px * w * 0.6, y2 + py * w * 0.6);
  gfx.moveTo(x1 - px * w, y1 - py * w);
  gfx.lineTo(x2 - px * w * 0.6, y2 - py * w * 0.6);
  gfx.stroke({ color: COL.hullMid, width: 1.8, alpha: active ? 0.75 : 0.3 });

  gfx.moveTo(x1 + px * w, y1 + py * w);
  gfx.lineTo(x2 - px * w * 0.6, y2 - py * w * 0.6);
  gfx.moveTo(x1 - px * w, y1 - py * w);
  gfx.lineTo(x2 + px * w * 0.6, y2 + py * w * 0.6);
  gfx.stroke({ color: COL.hullLite, width: 0.9, alpha: active ? 0.45 : 0.2 });
}

function drawGateStructure(
  gfx: Graphics,
  gate: TutorialBoostGate,
  now: number,
  active: boolean,
  pulse: number,
): void {
  const { left, right } = gatePillarPositions(gate);
  const ang = gate.angle;
  const nx = Math.cos(ang);
  const ny = Math.sin(ang);
  const px = Math.cos(ang + Math.PI / 2);
  const py = Math.sin(ang + Math.PI / 2);

  drawOctPlatform(gfx, left.x, left.y, ang, active, pulse);
  drawOctPlatform(gfx, right.x, right.y, ang, active, pulse);

  drawLatticeStub(gfx, left.x, left.y, ang, 22, active);
  drawLatticeStub(gfx, right.x, right.y, ang, 22, active);

  const lintelF = 10;
  const lx = left.x + nx * lintelF;
  const ly = left.y + ny * lintelF;
  const rx = right.x + nx * lintelF;
  const ry = right.y + ny * lintelF;
  const inset = gate.halfWidth * 0.52;

  const tlx = lx + px * inset;
  const tly = ly + py * inset;
  const trx = rx - px * inset;
  const try_ = ry - py * inset;

  gfx.moveTo(tlx, tly);
  gfx.lineTo(trx, try_);
  gfx.stroke({ color: COL.hullMid, width: 3.2, alpha: active ? 0.8 : 0.35 });

  gfx.moveTo(tlx, tly);
  gfx.lineTo(trx, try_);
  gfx.stroke({ color: COL.steelRim, width: 0.9, alpha: active ? 0.55 : 0.22 });

  const mx = (tlx + trx) * 0.5;
  const my = (tly + try_) * 0.5;
  const brace = gate.halfWidth * 0.28;
  gfx.moveTo(mx + px * brace, my + py * brace);
  gfx.lineTo(mx - px * brace, my - py * brace);
  gfx.moveTo(mx - px * brace, my + py * brace);
  gfx.lineTo(mx + px * brace, my - py * brace);
  gfx.stroke({ color: COL.hullLite, width: 1.1, alpha: active ? 0.5 : 0.2 });

  const planeAlpha = active ? 0.22 + pulse * 0.38 : 0.07;
  gfx.moveTo(left.x, left.y);
  gfx.lineTo(right.x, right.y);
  gfx.stroke({ color: COL.cyan, width: 1.8, alpha: planeAlpha });

  const segCount = 6;
  const arcR = gate.halfWidth * 0.92;
  const spin = now * 0.00035;
  for (let j = 0; j < segCount; j++) {
    const a0 = ang + Math.PI / 2 + spin + (j / segCount) * TAU;
    const a1 = a0 + (TAU / segCount) * 0.55;
    gfx.arc(gate.x, gate.y, arcR, a0, a1);
    gfx.stroke({
      color: j % 2 === 0 ? COL.cyanGlow : COL.cyanMid,
      width: j % 2 === 0 ? 1.8 : 1.1,
      alpha: planeAlpha * (j % 2 === 0 ? 1 : 0.65),
    });
  }

  gfx.circle(gate.x, gate.y, gate.halfWidth * 0.12);
  gfx.fill({ color: COL.cyanGlow, alpha: active ? 0.08 + pulse * 0.12 : 0.03 });
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

  if (!getState().player?.tutorial?.active || getState().player.sysIdx !== 0) {
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
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + gate.x * 0.001);
    bundle.container.visible = true;
    bundle.gfx.clear();
    drawGateStructure(bundle.gfx, gate, now, active, pulse);
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
