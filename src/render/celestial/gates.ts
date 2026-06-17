/**
 * Warp gate rendering - segmented rings, vortex core, labels.
 */
import { Container, Graphics, Text } from "pixi.js";
import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import type { Gate } from "../../types/station.js";
import type { System } from "../../types/system.js";
import { stationLayer, effectLayer } from "../../pixi.js";
import {
  formatWorldLabelText,
  getWorldLabelTextStyle,
  layoutWorldLabelCard,
} from "../world-label-card.js";
import { isVisible } from "../../utils/game.js";
import { shouldShowWarpGate, isTutorialExitGate, canWarpThroughGate } from "../../data/tutorial.js";
import { gateStableId, gateWorldLabel } from "../../utils/warp-gates.js";
import { addParticle } from "../../utils/entities.js";

export interface GateBundle {
  id: string;
  container: Container;
  foregroundContainer: Container;
  hull: Graphics;
  rings: Graphics;
  core: Graphics;
  foregroundRim: Graphics;
  labelBg: Graphics;
  labelText: Text;
}

export let _gateBundles: GateBundle[] = [];

const TAU = Math.PI * 2;

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

type GateRenderState = NonNullable<Gate["gateState"]> | "primed";

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

export function initGateSprites(sys: System): void {
  _gateBundles = [];
  if (!sys.gates) return;

  for (const g of sys.gates) {
    const gateCont = new Container();
    gateCont.x = g.x;
    gateCont.y = g.y;
    stationLayer!.addChild(gateCont);

    // Outer segmented hull ring (Expanse-style)
    const hull = new Graphics();
    gateCont.addChild(hull);

    // Core vortex
    const core = new Graphics();
    gateCont.addChild(core);

    // Segment rings
    const rings = new Graphics();
    gateCont.addChild(rings);

    const gateForeCont = new Container();
    gateForeCont.x = g.x;
    gateForeCont.y = g.y;
    (effectLayer ?? stationLayer)!.addChild(gateForeCont);

    const foregroundRim = new Graphics();
    gateForeCont.addChild(foregroundRim);

    // Background card
    const labelBg = new Graphics();
    gateCont.addChild(labelBg);

    // Label Text (now centered vertically for premium layout)
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
      foregroundContainer: gateForeCont,
      hull,
      rings,
      core,
      foregroundRim,
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

  if (!sys.gates || _gateBundles.length !== sys.gates.length) return;

  for (let i = 0; i < sys.gates.length; i++) {
    const g = sys.gates[i]!;
    const b = _gateBundles[i]!;
    const player = getState().player;
    const isGateVisible = shouldShowWarpGate(g, sys.idx, player) && isVisible(g.x, g.y, g.radius * 2.5);
    const palette = gateColorPalette(g, player);
    const gateId = gateStableId(g);
    const gateHint = Client.warpGateHint && Client.warpGateHint.gateId === gateId ? Client.warpGateHint : null;
    b.container.x = g.x;
    b.container.y = g.y;
    b.foregroundContainer.x = g.x;
    b.foregroundContainer.y = g.y;
    b.container.visible = isGateVisible;
    b.foregroundContainer.visible = isGateVisible;

    if (isGateVisible) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
      const corePulse = 0.7 + 0.3 * Math.sin(now * 0.004);

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

      const isTemp = g.isTemporary ?? false;
      const isCharging = state === "charging";
      const chargeBoost = isCharging ? charge : 0;
      const energyBoost = chargeBoost;

      let renderScale = 2.0;
      let renderAlpha = 0.2;
      let spinSpeed = 0.0001;
      let showParticles = false;

      if (state === "dormant") {
        renderScale = 2.0;
        renderAlpha = 0.2;
        spinSpeed = 0;
      } else if (state === "primed") {
        const primedCharge = Math.max(0.15, charge);
        renderScale = 2.1 + primedCharge * 0.35;
        renderAlpha = 0.35 + primedCharge * 0.4;
        spinSpeed = 0.0002 + primedCharge * 0.00035;
      } else if (state === "charging" || state === "active" || state === "cooldown") {
        renderScale = 2.0 + charge * 0.9;
        renderAlpha = 0.3 + charge * 0.85;
        spinSpeed = 0.0002 + charge * 0.0012;
        showParticles = charge > 0.25;
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
              life: 0.2 + Math.random() * 0.3,
              color: Math.random() > 0.5 ? "#aaddff" : "#66aaff",
              r: 0.8 + Math.random() * 1.2,
              drag: 0.05,
            });
          }
        }
      }
      
      // Handle dispense fade out
      if (isTemp && g.dispenseTimer !== undefined && g.dispenseTimer !== null) {
        const fadeProgress = Math.min(1, g.dispenseTimer / 3.0);
        renderAlpha *= fadeProgress;
      }
      
      const RENDER_SCALE = renderScale;
      const visR = g.radius * RENDER_SCALE;

      // --- 0. OUTER SEGMENTED HULL RING ---
      b.hull.clear();
      const hullSpin = now * spinSpeed;
      const hullSegments = state === "dormant" ? 6 : 12;
      for (let j = 0; j < hullSegments; j++) {
        const a = hullSpin + (j / hullSegments) * TAU;
        const ar = a + (1 / hullSegments) * TAU * 0.85;
        const isMajor = j % 3 === 0;
        const segR = visR * (isMajor ? 1.0 : 0.96);
        b.hull.moveTo(Math.cos(a) * segR, Math.sin(a) * segR);
        b.hull.arc(0, 0, segR, a, ar);
        const hullColor = energyBoost > 0
          ? (isMajor ? 0x88ddff : 0x55aacc)
          : (isMajor ? palette.hullMajor : palette.hullMinor);
        const hullWidth = isMajor ? 3.5 + energyBoost * 1.5 : 2.5 + energyBoost;
        const hullAlpha = isMajor
          ? (0.55 + pulse * 0.2 + energyBoost * 0.25) * renderAlpha
          : (0.35 + energyBoost * 0.3) * renderAlpha;
        b.hull.stroke({
          color: hullColor,
          width: hullWidth,
          alpha: hullAlpha,
        });
      }

      // --- 1. CORE VORTEX (simplified 3-layer) ---
      b.core.clear();

      // Charging expansion: core grows dramatically as energy builds
      const coreScale = 1 + energyBoost * 0.6;

      // Outer glow
      b.core.circle(0, 0, g.radius * 0.75 * coreScale).fill({
        color: palette.coreOuter,
        alpha: (0.15 + pulse * 0.1 + energyBoost * 0.2) * renderAlpha
      });

      // Charging plasma layer (electric blue)
      if (energyBoost > 0) {
        b.core.circle(0, 0, g.radius * 0.65 * coreScale).fill({
          color: 0x4499ff,
          alpha: energyBoost * 0.25 * renderAlpha
        });
      }

      // Mid glow
      b.core.circle(0, 0, g.radius * 0.48 * coreScale).fill({
        color: energyBoost > 0 ? 0x66bbff : palette.coreMid,
        alpha: (0.35 + corePulse * 0.25 + energyBoost * 0.3) * renderAlpha
      });

      // Bright center
      b.core.circle(0, 0, g.radius * 0.22 * coreScale).fill({
        color: energyBoost > 0 ? 0xddeeff : palette.coreInner,
        alpha: (0.70 + corePulse * 0.25 + energyBoost * 0.25) * renderAlpha
      });

      // --- CHARGING ENERGY ARCS ---
      if (isCharging && charge > 0.3) {
        const arcIntensity = (charge - 0.3) / 0.7;
        const numArcs = 3 + Math.floor(arcIntensity * 5);
        for (let aIdx = 0; aIdx < numArcs; aIdx++) {
          const baseAng = (aIdx / numArcs) * TAU + now * 0.0015 + charge * Math.PI;
          const startR = g.radius * (0.9 + Math.sin(now * 0.005 + aIdx) * 0.08);
          const endR = g.radius * (0.15 + Math.sin(now * 0.008 + aIdx * 2) * 0.05);
          const x1 = Math.cos(baseAng) * startR;
          const y1 = Math.sin(baseAng) * startR;
          const x2 = Math.cos(baseAng + 0.3) * endR;
          const y2 = Math.sin(baseAng + 0.3) * endR;
          const mx = (x1 + x2) * 0.5 + Math.sin(now * 0.01 + aIdx) * g.radius * 0.15;
          const my = (y1 + y2) * 0.5 + Math.cos(now * 0.012 + aIdx) * g.radius * 0.15;
          b.core.moveTo(x1, y1);
          b.core.quadraticCurveTo(mx, my, x2, y2);
          b.core.stroke({
            color: 0x88ccff,
            width: 1.5 + arcIntensity * 2.5,
            alpha: arcIntensity * (0.4 + 0.3 * Math.sin(now * 0.02 + aIdx)) * renderAlpha,
          });
          // Glow behind arc
          b.core.moveTo(x1, y1);
          b.core.quadraticCurveTo(mx, my, x2, y2);
          b.core.stroke({
            color: 0x5599ff,
            width: 4 + arcIntensity * 4,
            alpha: arcIntensity * 0.15 * renderAlpha,
          });
        }
      }

      // --- 2. CONCENTRIC COUNTER-ROTATING RINGS ---
      b.rings.clear();

      const spin = (g.spin ?? 0) + now * spinSpeed;

      // Outer ring
      const outerTicks = state === "dormant" ? 4 : 8;
      const outerDash = 0.6;
      for (let j = 0; j < outerTicks; j++) {
        const a = spin + (j / outerTicks) * TAU;
        const ar = a + (1 / outerTicks) * TAU * outerDash;
        b.rings.moveTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius);
        b.rings.arc(0, 0, g.radius, a, ar);
        b.rings.stroke({
          color: palette.ringOuter,
          width: 2.5,
          alpha: (0.55 + pulse * 0.2) * renderAlpha,
        });
      }

      // Inner counter-spin ring
      const innerRadius = g.radius * 0.72;
      const innerSpin = -spin * 0.6;
      const innerTicks = state === "dormant" ? 3 : 6;
      const innerDash = 0.5;
      for (let j = 0; j < innerTicks; j++) {
        const a = innerSpin + (j / innerTicks) * TAU;
        const ar = a + (1 / innerTicks) * TAU * innerDash;
        b.rings.moveTo(Math.cos(a) * innerRadius, Math.sin(a) * innerRadius);
        b.rings.arc(0, 0, innerRadius, a, ar);
        b.rings.stroke({
          color: palette.ringInner,
          width: 2.0,
          alpha: (0.45 + pulse * 0.15) * renderAlpha,
        });
      }

      // Subtle outer rim
      b.foregroundRim.clear();
      b.foregroundRim.circle(0, 0, visR * 0.98).stroke({
        color: palette.rim,
        width: 1.5,
        alpha: (0.15 + pulse * 0.1) * renderAlpha,
      });
      
      // Spark particles for active state
      if (showParticles) {
        const numSparks = 8;
        for (let sIdx = 0; sIdx < numSparks; sIdx++) {
          const sparkAng = (sIdx / numSparks) * TAU + now * 0.0012;
          const orbitR = visR * 0.94;
          const sx = Math.cos(sparkAng) * orbitR;
          const sy = Math.sin(sparkAng) * orbitR;
          const sparkAlpha = (0.4 + 0.4 * Math.sin(now * 0.01 + sIdx)) * renderAlpha;
          const sparkColor = sIdx % 2 === 0 ? palette.sparkPrimary : palette.sparkSecondary;
          b.core.circle(sx, sy, 1.5)
            .fill({ color: sparkColor, alpha: sparkAlpha });
        }
      }
    }
  }
}

export function destroyGateSprites(): void {
  for (const b of _gateBundles) {
    b.container.destroy({ children: true });
    b.foregroundContainer.destroy({ children: true });
  }
  _gateBundles = [];
}

export function refreshGateFonts() {
  for (const b of _gateBundles) {
    layoutWorldLabelCard(b.labelBg, b.labelText);
  }
}
