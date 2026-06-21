/**
 * Warp gate rendering — GPU mesh shader for the portal, plus label cards.
 *
 * The gate visuals (hull ring, vortex portal, dashed rings, energy arcs,
 * sparks, core, rim halo) are all rendered by a single GPU Mesh + custom
 * shader (see `pixi-warp-gate-mesh.ts`). This module owns the per-gate
 * label cards and feeds render data to the mesh each frame.
 */
import { Container, Graphics, Text } from "pixi.js";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import type { Gate } from "../../types/station.js";
import type { System } from "../../types/system.js";
import { stationLayer } from "../../pixi.js";
import {
  formatWorldLabelText,
  getWorldLabelTextStyle,
  layoutWorldLabelCard,
} from "../world-label-card.js";
import { isVisible } from "../../utils/game.js";
import { shouldShowWarpGate, isTutorialExitGate, canWarpThroughGate } from "../../data/tutorial.js";
import { gateStableId, gateWorldLabel } from "../../utils/warp-gates.js";
import { addParticle } from "../../utils/entities.js";
import {
  buildWarpGateMesh,
  syncWarpGateMesh,
  destroyWarpGateMesh,
  hexToRgbTuple,
  type WarpGateRenderData,
  type WarpGateColorSet,
} from "../pixi-warp-gate-mesh.js";

export interface GateBundle {
  id: string;
  container: Container;
  labelBg: Graphics;
  labelText: Text;
}

export let _gateBundles: GateBundle[] = [];

type GateRenderState = NonNullable<Gate["gateState"]> | "primed";

interface GateColorPalette {
  hullMajor: number;
  hullMinor: number;
  coreOuter: number;
  coreMid: number;
  coreInner: number;
  ringOuter: number;
  ringInner: number;
  rim: number;
  sparkPrimary: number;
  sparkSecondary: number;
}

const DEFAULT_COLORS: GateColorPalette = {
  hullMajor: 0x78c0ff,
  hullMinor: 0x3c6078,
  coreOuter: 0x285ac8,
  coreMid: 0x5fa0d0,
  coreInner: 0xe0f0ff,
  ringOuter: 0x78c0ff,
  ringInner: 0x5fa0d0,
  rim: 0x9ee8ff,
  sparkPrimary: 0xffffff,
  sparkSecondary: 0x78c0ff,
};

const RETURN_COLORS: GateColorPalette = {
  hullMajor: 0xffc767,
  hullMinor: 0x7e4d18,
  coreOuter: 0x472108,
  coreMid: 0xffa443,
  coreInner: 0xfff0c8,
  ringOuter: 0xffb347,
  ringInner: 0xff8a3c,
  rim: 0xfff3cf,
  sparkPrimary: 0xfff6dc,
  sparkSecondary: 0xffa347,
};

const TEMP_COLORS: GateColorPalette = {
  hullMajor: 0xf07bff,
  hullMinor: 0x4d2b57,
  coreOuter: 0x3a0b46,
  coreMid: 0xd46cff,
  coreInner: 0xffe4ff,
  ringOuter: 0xfba1ff,
  ringInner: 0xc467ff,
  rim: 0xffd4ff,
  sparkPrimary: 0xfff0ff,
  sparkSecondary: 0xf5b7ff,
};

const LOCKED_COLORS: GateColorPalette = {
  hullMajor: 0xff4444,
  hullMinor: 0x662222,
  coreOuter: 0x441111,
  coreMid: 0xcc3333,
  coreInner: 0xff6666,
  ringOuter: 0xff5555,
  ringInner: 0xcc4444,
  rim: 0xff8888,
  sparkPrimary: 0xffaaaa,
  sparkSecondary: 0xff4444,
};

function gateColorPalette(g: Gate, player?: import("../../state.js").Player): GateColorPalette {
  if (player && isTutorialExitGate(g, player.sysIdx ?? 0) && !canWarpThroughGate(g, player.sysIdx ?? 0, player)) {
    return LOCKED_COLORS;
  }
  switch (g.fxProfile) {
    case "tutorial-return":
      return RETURN_COLORS;
    case "temporary":
      return TEMP_COLORS;
    default:
      return DEFAULT_COLORS;
  }
}

/** Map a full palette to the 3-color set the GPU shader needs. */
function gateShaderColors(p: GateColorPalette): WarpGateColorSet {
  return {
    hull: hexToRgbTuple(p.hullMajor),
    portal: hexToRgbTuple(p.coreMid),
    core: hexToRgbTuple(p.coreInner),
  };
}

/** Stable per-gate seed derived from the gate id. */
function gateSeed(gateId: string): number {
  let h = 0;
  for (let i = 0; i < gateId.length; i++) {
    h = (h * 31 + gateId.charCodeAt(i)) | 0;
  }
  return ((h % 1000) + 1000) % 1000 / 1000;
}

/** Map a GateRenderState to the shader's numeric state enum. */
function stateToShaderEnum(state: GateRenderState): number {
  switch (state) {
    case "dormant": return 0;
    case "primed": return 1;
    case "charging": return 2;
    default: return 3; // active, warping, cooldown
  }
}

export function initGateSprites(sys: System): void {
  // Destroy old label bundles
  for (const b of _gateBundles) {
    b.container.destroy({ children: true });
  }
  _gateBundles = [];

  // Build the GPU mesh (idempotent — skips if already built)
  buildWarpGateMesh();

  if (!sys.gates) return;

  for (const g of sys.gates) {
    const gateCont = new Container();
    gateCont.x = g.x;
    gateCont.y = g.y;
    stationLayer!.addChild(gateCont);

    // Background card
    const labelBg = new Graphics();
    gateCont.addChild(labelBg);

    // Label Text
    const targetName = gateWorldLabel(g, getState().GALAXY);
    const labelY = g.radius + 22;
    const labelText = new Text({
      text: formatWorldLabelText(`⟩⟩ ${targetName}`),
      style: getWorldLabelTextStyle(),
    });
    labelText.anchor.set(0.5, 0.5);
    labelText.x = 0;
    labelText.y = labelY;
    labelBg.x = 0;
    labelBg.y = labelY;
    gateCont.addChild(labelText);
    layoutWorldLabelCard(labelBg, labelText);
    // Hide name plates
    labelText.visible = false;
    labelBg.visible = false;

    _gateBundles.push({
      id: gateStableId(g),
      container: gateCont,
      labelBg,
      labelText,
    });
  }
}

export function syncGateSprites(now: number, sys: System): void {
  const gateIdsMatch = _gateBundles.length === (sys.gates?.length ?? 0)
    && (sys.gates ?? []).every((g, i) => _gateBundles[i]?.id === gateStableId(g));

  if (!gateIdsMatch && stationLayer) {
    initGateSprites(sys);
    return;
  }

  if (!sys.gates || _gateBundles.length !== sys.gates.length) {
    syncWarpGateMesh(now, []);
    return;
  }

  const player = getState().player;
  const renderData: WarpGateRenderData[] = [];

  for (let i = 0; i < sys.gates.length; i++) {
    const g = sys.gates[i]!;
    const b = _gateBundles[i]!;
    const isGateVisible = shouldShowWarpGate(g, sys.idx, player) && isVisible(g.x, g.y, g.radius * 2.5);
    const palette = gateColorPalette(g, player);
    const gateId = gateStableId(g);
    const gateHint = Client.warpGateHint && Client.warpGateHint.gateId === gateId ? Client.warpGateHint : null;

    // Update label container position
    b.container.x = g.x;
    b.container.y = g.y;
    b.container.visible = isGateVisible;

    if (!isGateVisible) {
      renderData.push({
        id: gateId,
        x: g.x,
        y: g.y,
        radius: g.radius,
        visible: false,
        charge: 0,
        state: 0,
        spin: g.spin ?? 0,
        seed: gateSeed(gateId),
        colors: gateShaderColors(palette),
        alpha: 0,
      });
      continue;
    }

    let state: GateRenderState = g.gateState ?? "dormant";
    let charge = g.chargeProgress ?? 0;
    if (gateHint) {
      if (typeof gateHint.chargeProgress === "number") {
        charge = Math.max(charge, Math.min(1, gateHint.chargeProgress));
      }
      if (state === "dormant") {
        if (gateHint.isCharging) state = "charging";
        else if (gateHint.inRange) state = "primed";
      }
    }

    const isCharging = state === "charging";
    const chargeBoost = isCharging ? charge : 0;
    const isTemp = g.isTemporary ?? false;

    // Render alpha / scale logic (mirrors the old Graphics implementation)
    let renderAlpha = 0.2;
    if (state === "dormant") {
      renderAlpha = 0.2;
    } else if (state === "primed") {
      const primedCharge = Math.max(0.15, charge);
      renderAlpha = 0.35 + primedCharge * 0.4;
    } else if (state === "charging" || state === "active" || state === "cooldown") {
      renderAlpha = 0.3 + charge * 0.85;
    }

    // Temporary gate fade-out
    if (isTemp && g.dispenseTimer !== undefined && g.dispenseTimer !== null) {
      const fadeProgress = Math.min(1, g.dispenseTimer / 3.0);
      renderAlpha *= fadeProgress;
    }

    // Suction particles: stream from player toward gate center during charge only
    if (state === "charging" && player && gateHint?.inRange) {
      const dx = g.x - player.x;
      const dy = g.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > g.radius) {
        const streamCount = Math.floor(charge * 3);
        for (let s = 0; s < streamCount; s++) {
          const t = Math.random();
          const spread = 30 + charge * 40;
          const px = player.x + dx * t + (Math.random() - 0.5) * spread;
          const py = player.y + dy * t + (Math.random() - 0.5) * spread;
          const spd = 60 + charge * 200;
          addParticle({
            x: px,
            y: py,
            vx: (dx / dist) * spd + (Math.random() - 0.5) * 20,
            vy: (dy / dist) * spd + (Math.random() - 0.5) * 20,
            life: 0.4 + charge * 0.3,
            color: Math.random() > 0.5 ? "#aaddff" : "#66aaff",
            r: 0.8 + Math.random() * 1.2,
            drag: 0.05,
          });
        }
      }
    }

    renderData.push({
      id: gateId,
      x: g.x,
      y: g.y,
      radius: g.radius,
      visible: true,
      charge: chargeBoost,
      state: stateToShaderEnum(state),
      spin: g.spin ?? 0,
      seed: gateSeed(gateId),
      colors: gateShaderColors(palette),
      alpha: renderAlpha,
    });
  }

  syncWarpGateMesh(now, renderData);
}

export function destroyGateSprites(): void {
  for (const b of _gateBundles) {
    b.container.destroy({ children: true });
  }
  _gateBundles = [];
  destroyWarpGateMesh();
}

export function refreshGateFonts() {
  for (const b of _gateBundles) {
    layoutWorldLabelCard(b.labelBg, b.labelText);
  }
}
