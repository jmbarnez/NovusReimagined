/**
 * Tutorial boost gates — GPU mesh renderer.
 *
 * Replaces the old Graphics-based line-and-cap drawing with a single GPU
 * Mesh + custom shader (see `pixi-boost-gate-mesh.ts`). The shader draws a
 * clean plasma curtain, crisp pillar nodes, sharp traveling sparks, and a
 * minimal short warp flash on pass-through. A brief particle burst is
 * emitted client-side when a fresh gate crossing is detected.
 */
import { getState } from "../state-access.js";
import { isVisible } from "../utils/game.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import {
  TUTORIAL_BOOST_GATES,
  getActiveTutorialTracks,
  type TutorialBoostGate,
} from "../data/tutorial-layout.js";
import {
  buildBoostGateMesh,
  syncBoostGateMesh,
  destroyBoostGateMesh,
  computeGateCharge,
  computeGateFlash,
  type BoostGateRenderData,
} from "./pixi-boost-gate-mesh.js";
import { addParticle } from "../utils/entities.js";

/** Stable per-gate seed derived from the gate id (deterministic across frames). */
function gateSeed(gateId: string): number {
  let h = 0;
  for (let i = 0; i < gateId.length; i++) {
    h = (h * 31 + gateId.charCodeAt(i)) | 0;
  }
  return ((h % 1000) + 1000) % 1000 / 1000;
}

function getActiveBoostGates(stepId: string): TutorialBoostGate[] {
  const activeTrackIds = new Set(getActiveTutorialTracks(stepId).map((t: { id: string }) => t.id));
  return TUTORIAL_BOOST_GATES.filter((g: TutorialBoostGate) => activeTrackIds.has(g.trackId));
}

/** Tracks the previous-frame cooldown for each gate to detect fresh crossings. */
const _prevCooldowns = new Map<string, number>();

/** Threshold above which a cooldown value indicates a fresh pass-through. */
const FRESH_CROSSING_THRESHOLD = 2.5;

/** Emit a dramatic cloudy explosion of particles projecting out of the gate
 *  on the exit side — the same side the player emerges from. The burst has
 *  three layers, all spawning at the gate plane and accelerating forward:
 *    - A forward cone of fast bright sparks erupting ahead
 *    - A cloudy volume of slower, larger, longer-lived particles billowing forward
 *    - A few wide sideways puffs for volume
 *
 *  The explosion reads as "the gate blasted the player through." */
function emitPassThroughBurst(gate: TutorialBoostGate, travelDirX: number, travelDirY: number): void {
  // Normalize travel direction; fall back to gate angle if stationary
  const tLen = Math.hypot(travelDirX, travelDirY);
  let nx: number, ny: number;
  if (tLen > 1.0) {
    nx = travelDirX / tLen;
    ny = travelDirY / tLen;
  } else {
    nx = Math.cos(gate.angle);
    ny = Math.sin(gate.angle);
  }
  const px = -ny; // perpendicular to travel
  const py = nx;

  // ── Layer 1: forward cone of bright sparks ──────────────────────────
  // Erupts ahead of the gate in a tight cone, fast and sharp
  const coneCount = 22;
  for (let i = 0; i < coneCount; i++) {
    const widthOff = (Math.random() - 0.5) * gate.halfWidth * 1.4;
    // Cone spread: narrow at the gate, widening forward
    const coneSpread = (Math.random() - 0.5) * 0.5; // radians
    const cn = Math.cos(coneSpread);
    const sn = Math.sin(coneSpread);
    const dirX = nx * cn - ny * sn;
    const dirY = nx * sn + ny * cn;
    const speed = 280 + Math.random() * 220;
    addParticle({
      x: gate.x + px * widthOff,
      y: gate.y + py * widthOff,
      vx: dirX * speed + (Math.random() - 0.5) * 40,
      vy: dirY * speed + (Math.random() - 0.5) * 40,
      life: 0.35 + Math.random() * 0.3,
      color: Math.random() > 0.25 ? "#ffffff" : "#aaddff",
      r: 0.6 + Math.random() * 0.7,
      drag: 0.04,
      decay: 1.3,
    });
  }

  // ── Layer 2: cloudy volume on the exit side ────────────────────────
  // Slower, larger, longer-lived particles for a smoky/cloudy volume
  // projecting forward from the gate on the same side the player exits
  const cloudCount = 28;
  for (let i = 0; i < cloudCount; i++) {
    const widthOff = (Math.random() - 0.5) * gate.halfWidth * 1.8;
    // Start at or slightly ahead of the gate plane (exit side)
    const fwdOff = Math.random() * 30;
    const speed = 80 + Math.random() * 140;
    // Cloudy particles spread more randomly
    const swirl = (Math.random() - 0.5) * 0.9; // wider angular spread
    const cn = Math.cos(swirl);
    const sn = Math.sin(swirl);
    const dirX = nx * cn - ny * sn;
    const dirY = nx * sn + ny * cn;
    addParticle({
      x: gate.x + px * widthOff + nx * fwdOff,
      y: gate.y + py * widthOff + ny * fwdOff,
      vx: dirX * speed + (Math.random() - 0.5) * 60,
      vy: dirY * speed + (Math.random() - 0.5) * 60,
      life: 0.5 + Math.random() * 0.5,
      color: Math.random() > 0.4 ? "#88bbff" : "#5599dd",
      r: 1.2 + Math.random() * 1.8,
      drag: 0.08,
      decay: 0.7,
    });
  }

  // ── Layer 3: wide sideways puffs for volume ────────────────────────
  // A handful of particles kicked perpendicular to the travel direction
  const puffCount = 10;
  for (let i = 0; i < puffCount; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const widthOff = side * (gate.halfWidth * 0.5 + Math.random() * gate.halfWidth * 0.6);
    const sideSpeed = 60 + Math.random() * 100;
    const fwdSpeed = 40 + Math.random() * 80;
    addParticle({
      x: gate.x + px * widthOff,
      y: gate.y + py * widthOff,
      vx: px * side * sideSpeed + nx * fwdSpeed,
      vy: py * side * sideSpeed + ny * fwdSpeed,
      life: 0.4 + Math.random() * 0.35,
      color: Math.random() > 0.5 ? "#aaccff" : "#ffffff",
      r: 0.9 + Math.random() * 1.2,
      drag: 0.06,
      decay: 1.0,
    });
  }
}

export function refreshTutorialGateFonts(): void {
  // No-op: boost gates use a GPU shader, no text.
}

export function initPixiTutorialGates(): void {
  buildBoostGateMesh();
}

export function syncPixiTutorialGates(now: number): void {
  initPixiTutorialGates();

  const player = getState().player;
  if (!player?.tutorial?.active || player.sysIdx !== 0) {
    _prevCooldowns.clear();
    syncBoostGateMesh(now, []);
    return;
  }

  const step = getCurrentTutorialStep(player);
  const activeGates = step ? getActiveBoostGates(step.id) : [];
  if (activeGates.length === 0) {
    _prevCooldowns.clear();
    syncBoostGateMesh(now, []);
    return;
  }

  const cooldowns = player.gateCooldowns ?? {};
  const renderData: BoostGateRenderData[] = activeGates.map((g) => {
    const visible = isVisible(g.x, g.y, g.halfWidth + 120);
    const cd = cooldowns[g.id] ?? 0;
    const charge = visible
      ? computeGateCharge(g.x, g.y, g.angle, g.halfWidth, player.x, player.y)
      : 0;
    const flash = computeGateFlash(cd);

    // Detect fresh crossing: cooldown jumped above threshold this frame
    const prevCd = _prevCooldowns.get(g.id) ?? 0;
    if (cd > FRESH_CROSSING_THRESHOLD && prevCd <= FRESH_CROSSING_THRESHOLD && visible) {
      emitPassThroughBurst(g, player.vx, player.vy);
    }
    _prevCooldowns.set(g.id, cd);

    return {
      id: g.id,
      x: g.x,
      y: g.y,
      angle: g.angle,
      halfWidth: g.halfWidth,
      visible,
      charge,
      flash,
      seed: gateSeed(g.id),
    };
  });

  syncBoostGateMesh(now, renderData);
}

export function destroyPixiTutorialGates(): void {
  _prevCooldowns.clear();
  destroyBoostGateMesh();
}
