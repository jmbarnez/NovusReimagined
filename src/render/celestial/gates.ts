/**
 * Warp gate rendering - segmented rings, vortex core, labels.
 */
import { Container, Graphics, Text } from "pixi.js";
import { getState } from "../../state-access.js";
import type { System } from "../../types/world.js";
import { stationLayer, effectLayer } from "../../pixi.js";
import {
  formatWorldLabelText,
  getWorldLabelTextStyle,
  layoutWorldLabelCard,
} from "../world-label-card.js";
import { isVisible } from "../../utils/game.js";
import { shouldShowWarpGate } from "../../data/tutorial.js";
import { gateStableId, gateWorldLabel } from "../../utils/warp-gates.js";

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
    const isGateVisible = shouldShowWarpGate(g, sys.idx, getState().player) && isVisible(g.x, g.y, g.radius * 2.5);
    b.container.x = g.x;
    b.container.y = g.y;
    b.foregroundContainer.x = g.x;
    b.foregroundContainer.y = g.y;
    b.container.visible = isGateVisible;
    b.foregroundContainer.visible = isGateVisible;

    if (isGateVisible) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
      const corePulse = 0.7 + 0.3 * Math.sin(now * 0.004);
      
      // State-based rendering
      const state = g.gateState ?? "dormant";
      const charge = g.chargeProgress ?? 0;
      const isTemp = g.isTemporary ?? false;
      
      let renderScale = 2.0;
      let renderAlpha = 0.2;
      let spinSpeed = 0.0001;
      let showParticles = false;
      
      if (state === "dormant") {
        renderScale = 2.0;
        renderAlpha = 0.2;
        spinSpeed = 0.0001;
      } else if (state === "charging") {
        renderScale = 2.0 + charge * 0.8;
        renderAlpha = 0.2 + charge * 0.8;
        spinSpeed = 0.0001 + charge * 0.0005;
      } else if (state === "active") {
        renderScale = 2.8;
        renderAlpha = 1.0;
        spinSpeed = 0.0006;
        showParticles = true;
      } else if (state === "warping") {
        renderScale = 2.8;
        renderAlpha = 1.0;
        spinSpeed = 0.002;
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
        b.hull.stroke({
          color: isMajor ? 0x78c0ff : 0x3c6078,
          width: isMajor ? 3.5 : 2.5,
          alpha: isMajor ? (0.55 + pulse * 0.2) * renderAlpha : 0.35 * renderAlpha,
        });
      }

      // --- 1. CORE VORTEX (simplified 3-layer) ---
      b.core.clear();

      // Outer glow
      b.core.circle(0, 0, g.radius * 0.75).fill({
        color: 0x285ac8,
        alpha: (0.15 + pulse * 0.1) * renderAlpha
      });

      // Mid glow
      b.core.circle(0, 0, g.radius * 0.48).fill({
        color: 0x5fa0d0,
        alpha: (0.35 + corePulse * 0.25) * renderAlpha
      });

      // Bright center
      b.core.circle(0, 0, g.radius * 0.22).fill({
        color: 0xe0f0ff,
        alpha: (0.70 + corePulse * 0.25) * renderAlpha
      });

      // --- 2. CONCENTRIC COUNTER-ROTATING RINGS ---
      b.rings.clear();

      const spin = g.spin ?? 0;

      // Outer ring
      const outerTicks = state === "dormant" ? 4 : 8;
      const outerDash = 0.6;
      for (let j = 0; j < outerTicks; j++) {
        const a = spin + (j / outerTicks) * TAU;
        const ar = a + (1 / outerTicks) * TAU * outerDash;
        b.rings.moveTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius);
        b.rings.arc(0, 0, g.radius, a, ar);
        b.rings.stroke({
          color: 0x78c0ff,
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
          color: 0x5fa0d0,
          width: 2.0,
          alpha: (0.45 + pulse * 0.15) * renderAlpha,
        });
      }

      // Subtle outer rim
      b.foregroundRim.clear();
      b.foregroundRim.circle(0, 0, visR * 0.98).stroke({
        color: 0x9ee8ff,
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
          b.core.circle(sx, sy, 1.5)
            .fill({ color: sIdx % 2 === 0 ? 0xffffff : 0x78c0ff, alpha: sparkAlpha });
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
