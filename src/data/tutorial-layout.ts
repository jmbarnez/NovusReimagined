/** Single source of truth for S.T.A.R.T tutorial sector layout. */

import { C } from "../config/index.js";
import { SUN_WORLD_DIST } from "../utils/sun-position.js";
import {
  resolveTutorialGateHint,
  type TutorialGateHintKey,
} from "./tutorial-controls.js";

/** Cadet system sun sits far west; approach lane runs west→east into the Academy; training zones branch east. */
export const TUTORIAL_SUN_DIR = Math.PI;

export const TUTORIAL_SECTOR = {
  x: 0,
  y: 0,
  radius: 4500,
  name: "S.T.A.R.T Training Sector",
  security: 1.0,
} as const;

export const TUTORIAL_STATION = { x: 0, y: 0 } as const;
export const TUTORIAL_HUB = { x: 0, y: 0 } as const;
export const TUTORIAL_APPROACH_TARGET = TUTORIAL_STATION;

/** Distance from the Academy hub back toward the sun — spawn sits here (east of the sun, west of the hub). */
const TUTORIAL_SPAWN_DIST_FROM_HUB = 2300;
/** Small lateral offset so the lane misses the hub–sun axis. */
const TUTORIAL_SPAWN_SIDE = 320;

export function getTutorialSunWorldPos(): { x: number; y: number } {
  return {
    x: Math.cos(TUTORIAL_SUN_DIR) * SUN_WORLD_DIST,
    y: Math.sin(TUTORIAL_SUN_DIR) * SUN_WORLD_DIST,
  };
}

/** Player start — between the sun (west) and the Academy (center). */
export const TUTORIAL_SPAWN = (() => {
  const towardSun = TUTORIAL_SUN_DIR;
  const perp = TUTORIAL_SUN_DIR + Math.PI / 2;
  return {
    x: Math.round(Math.cos(towardSun) * TUTORIAL_SPAWN_DIST_FROM_HUB + Math.cos(perp) * TUTORIAL_SPAWN_SIDE),
    y: Math.round(Math.sin(towardSun) * TUTORIAL_SPAWN_DIST_FROM_HUB + Math.sin(perp) * TUTORIAL_SPAWN_SIDE),
  };
})();

/** True when the player should be moved to {@link TUTORIAL_SPAWN}. */
export function shouldRelocateTutorialStart(x: number, y: number): boolean {
  if (Math.hypot(x, y) < 320) return true;
  const sun = getTutorialSunWorldPos();
  if (Math.hypot(x - sun.x, y - sun.y) < 1100) return true;
  if (x > 450) return true;
  if (x < TUTORIAL_SPAWN.x - 450) return true;
  return false;
}

/** Training zones — east of the Academy hub. */
export const TUTORIAL_BELT_CENTER = { x: 2800, y: 0 } as const;
/** Mining belt completion radius — covers full asteroid spawn spread plus margin. */
export const TUTORIAL_MINING_ZONE_R = Math.max(620, C.WORLD.SECTOR.beltSpread.hi + 80);
export const TUTORIAL_GUNNERY_CENTER = { x: 2200, y: 1600 } as const;
export const TUTORIAL_TRAINING_SITE_X = 2000;
export const TUTORIAL_TRAINING_SITE_Y = 2900;
/** Stargate — farthest east (Novus Prime link). */
export const TUTORIAL_GATE = { x: 3600, y: 0 } as const;

export interface TutorialLocalRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  stepId?: string;
}

export const TUTORIAL_LOCAL_REGIONS: TutorialLocalRegion[] = [
  { id: "tut-flight", name: "Flight Deck", x: -1650, y: -140, r: 200, stepId: "fly-academy" },
  { id: "tut-mining", name: "Mining Range", x: 2800, y: 0, r: TUTORIAL_MINING_ZONE_R, stepId: "targeting" },
  { id: "tut-industry", name: "Industry Bench", x: 0, y: 0, r: 280, stepId: "industry" },
  { id: "tut-gunnery", name: "Gunnery Bay", x: 2200, y: 1600, r: 160, stepId: "gunnery" },
  { id: "tut-signature", name: "Signal Trace", x: 2000, y: 2900, r: 240, stepId: "signature" },
];

// ─── Guided track lanes (hub-and-spoke) ───

export interface TutorialTrackSegment {
  id: string;
  points: { x: number; y: number }[];
  halfWidth: number;
  activeForSteps: string[];
}

export interface TutorialBoostGate {
  id: string;
  x: number;
  y: number;
  /** Travel direction — player flies along this bearing through the arch. */
  angle: number;
  halfWidth: number;
  strength: number;
  trackId: string;
  cooldownS: number;
  pillarHeight: number;
  hintKey?: TutorialGateHintKey;
}

export function getGateControlHint(gate: TutorialBoostGate): string | undefined {
  return gate.hintKey ? resolveTutorialGateHint(gate.hintKey) : undefined;
}

/** @deprecated alias */
export type TutorialBoostPad = TutorialBoostGate;

export function gatePillarPositions(gate: TutorialBoostGate): {
  left: { x: number; y: number };
  right: { x: number; y: number };
} {
  const perp = gate.angle + Math.PI / 2;
  const cos = Math.cos(perp);
  const sin = Math.sin(perp);
  return {
    left: { x: gate.x + cos * gate.halfWidth, y: gate.y + sin * gate.halfWidth },
    right: { x: gate.x - cos * gate.halfWidth, y: gate.y - sin * gate.halfWidth },
  };
}

/** True when the ship segment crosses the gate plane between the pillars. */
export function detectGateCrossing(
  gate: TutorialBoostGate,
  x: number,
  y: number,
  px: number,
  py: number,
  vx: number,
  vy: number,
): boolean {
  const nx = Math.cos(gate.angle);
  const ny = Math.sin(gate.angle);
  const pxp = Math.cos(gate.angle + Math.PI / 2);
  const pyp = Math.sin(gate.angle + Math.PI / 2);

  const curRx = x - gate.x;
  const curRy = y - gate.y;
  const prevRx = px - gate.x;
  const prevRy = py - gate.y;

  const lateral = curRx * pxp + curRy * pyp;
  if (Math.abs(lateral) > gate.halfWidth * 0.92) return false;

  const prevAlong = prevRx * nx + prevRy * ny;
  const curAlong = curRx * nx + curRy * ny;
  const crossedForward = prevAlong < 0 && curAlong >= 0;
  const crossedBackward = prevAlong >= 0 && curAlong < 0;
  if (!crossedForward && !crossedBackward) return false;
  if (Math.abs(curAlong) > gate.halfWidth * 1.4) return false;

  if (Math.hypot(vx, vy) < 4) return false;
  return Math.abs(vx * nx + vy * ny) > 3;
}

export interface TrackProximity {
  dist: number;
  closestX: number;
  closestY: number;
  tangentAngle: number;
  inside: boolean;
  arcLength: number;
  segmentIndex: number;
}

const HUB = TUTORIAL_HUB;

export const TUTORIAL_TRACKS: TutorialTrackSegment[] = [
  {
    id: "approach",
    points: [
      TUTORIAL_SPAWN,
      { x: -1900, y: -160 },
      { x: -950, y: -60 },
      { x: -280, y: 0 },
      HUB,
    ],
    halfWidth: 120,
    activeForSteps: ["fly-academy"],
  },
  {
    id: "spoke-mining",
    points: [HUB, { x: 1400, y: 0 }, TUTORIAL_BELT_CENTER],
    halfWidth: 110,
    activeForSteps: ["fly-mining"],
  },
  {
    id: "spoke-mining-return",
    points: [TUTORIAL_BELT_CENTER, { x: 1400, y: 0 }, HUB],
    halfWidth: 110,
    activeForSteps: ["fly-station"],
  },
  {
    id: "spoke-gunnery",
    points: [HUB, { x: 1100, y: 800 }, TUTORIAL_GUNNERY_CENTER],
    halfWidth: 110,
    activeForSteps: ["fly-gunnery"],
  },
  {
    id: "spoke-signature",
    points: [HUB, { x: 1000, y: 1450 }, { x: TUTORIAL_TRAINING_SITE_X, y: TUTORIAL_TRAINING_SITE_Y }],
    halfWidth: 110,
    activeForSteps: ["fly-signature"],
  },
  {
    id: "spoke-gate",
    points: [HUB, { x: 1800, y: 0 }, TUTORIAL_GATE],
    halfWidth: 110,
    activeForSteps: ["fly-gate"],
  },
];

function segmentLength(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; t: number; dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    const dist = Math.hypot(px - ax, py - ay);
    return { x: ax, y: ay, t: 0, dist };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t;
  const y = ay + dy * t;
  return { x, y, t, dist: Math.hypot(px - x, py - y) };
}

export function trackTotalArcLength(track: TutorialTrackSegment): number {
  let total = 0;
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    total += segmentLength(a.x, a.y, b.x, b.y);
  }
  return total;
}

export function distToTrack(track: TutorialTrackSegment, px: number, py: number): TrackProximity {
  let bestDist = Infinity;
  let bestX = px;
  let bestY = py;
  let bestTangent = 0;
  let bestSeg = 0;
  let arcLength = 0;
  let bestArc = 0;

  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const cp = closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
    const segLen = segmentLength(a.x, a.y, b.x, b.y);
    const partial = segLen * cp.t;
    if (cp.dist < bestDist) {
      bestDist = cp.dist;
      bestX = cp.x;
      bestY = cp.y;
      bestTangent = Math.atan2(b.y - a.y, b.x - a.x);
      bestSeg = i;
      bestArc = arcLength + partial;
    }
    arcLength += segLen;
  }

  return {
    dist: bestDist,
    closestX: bestX,
    closestY: bestY,
    tangentAngle: bestTangent,
    inside: bestDist <= track.halfWidth,
    arcLength: bestArc,
    segmentIndex: bestSeg,
  };
}

export function trackArcLengthProgress(track: TutorialTrackSegment, px: number, py: number): number {
  const total = trackTotalArcLength(track);
  if (total <= 0) return 0;
  const prox = distToTrack(track, px, py);
  return Math.max(0, Math.min(1, prox.arcLength / total));
}

export function getTutorialTrackById(id: string): TutorialTrackSegment | undefined {
  return TUTORIAL_TRACKS.find((t) => t.id === id);
}

export function getActiveTutorialTracks(stepId: string): TutorialTrackSegment[] {
  return TUTORIAL_TRACKS.filter((t) => t.activeForSteps.includes(stepId));
}

export function getTutorialTrackForNav(trackId: string | undefined): TutorialTrackSegment | undefined {
  if (!trackId) return undefined;
  return getTutorialTrackById(trackId);
}

function tangentAtArcLength(track: TutorialTrackSegment, arcLen: number): number {
  let acc = 0;
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const segLen = segmentLength(a.x, a.y, b.x, b.y);
    if (acc + segLen >= arcLen || i === track.points.length - 2) {
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
    acc += segLen;
  }
  const last = track.points[track.points.length - 1];
  const prev = track.points[track.points.length - 2];
  return Math.atan2(last.y - prev.y, last.x - prev.x);
}

function pointAtArcLength(track: TutorialTrackSegment, arcLen: number): { x: number; y: number } {
  let acc = 0;
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const segLen = segmentLength(a.x, a.y, b.x, b.y);
    if (acc + segLen >= arcLen) {
      const t = segLen > 0 ? (arcLen - acc) / segLen : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += segLen;
  }
  return track.points[track.points.length - 1];
}

const GATE_FRACTIONS = [0.15, 0.325, 0.5, 0.675, 0.85];

function buildBoostGatesForTrack(
  trackId: string,
  fractions: number[],
  strength: number,
  halfWidth = 108,
): TutorialBoostGate[] {
  const track = getTutorialTrackById(trackId);
  if (!track) return [];
  const total = trackTotalArcLength(track);
  return fractions.map((fraction, i) => {
    const arc = total * fraction;
    const pt = pointAtArcLength(track, arc);
    const angle = tangentAtArcLength(track, arc);
    return {
      id: `${trackId}-gate-${i}`,
      x: pt.x,
      y: pt.y,
      angle,
      halfWidth,
      strength,
      trackId,
      cooldownS: 4,
      pillarHeight: 150,
    };
  });
}

export const TUTORIAL_BOOST_GATES: TutorialBoostGate[] = [
  ...buildBoostGatesForTrack("approach", GATE_FRACTIONS, 220),
  ...buildBoostGatesForTrack("spoke-mining", GATE_FRACTIONS, 200),
  ...buildBoostGatesForTrack("spoke-mining-return", GATE_FRACTIONS, 200),
  ...buildBoostGatesForTrack("spoke-gunnery", GATE_FRACTIONS, 200),
  ...buildBoostGatesForTrack("spoke-signature", GATE_FRACTIONS, 200),
  ...buildBoostGatesForTrack("spoke-gate", GATE_FRACTIONS, 210),
];

/** @deprecated alias */
export const TUTORIAL_BOOST_PADS = TUTORIAL_BOOST_GATES;

export function getBoostGatesForTrack(trackId: string | undefined): TutorialBoostGate[] {
  if (!trackId) return [];
  return TUTORIAL_BOOST_GATES.filter((g) => g.trackId === trackId);
}

export function getBoostPadsForTrack(trackId: string | undefined): TutorialBoostGate[] {
  return getBoostGatesForTrack(trackId);
}

export function getBoostGatesForStep(stepId: string): TutorialBoostGate[] {
  const track = TUTORIAL_TRACKS.find((t) => t.activeForSteps.includes(stepId));
  return track ? getBoostGatesForTrack(track.id) : [];
}

export function getBoostPadsForStep(stepId: string): TutorialBoostGate[] {
  return getBoostGatesForStep(stepId);
}

export function snapToTrackCenterline(track: TutorialTrackSegment, px: number, py: number): { x: number; y: number } {
  const prox = distToTrack(track, px, py);
  return { x: prox.closestX, y: prox.closestY };
}

const HUB_ZONE = { x: TUTORIAL_HUB.x, y: TUTORIAL_HUB.y, r: 280 } as const;
const MINING_ZONE = { x: TUTORIAL_BELT_CENTER.x, y: TUTORIAL_BELT_CENTER.y, r: TUTORIAL_MINING_ZONE_R } as const;
const SIGNATURE_ZONE = { x: TUTORIAL_TRAINING_SITE_X, y: TUTORIAL_TRAINING_SITE_Y, r: 220 } as const;
const GATE_ZONE = { x: TUTORIAL_GATE.x, y: TUTORIAL_GATE.y, r: 280 } as const;

export function tutorialRegionZone(stepId: string): { x: number; y: number; r: number } {
  switch (stepId) {
    case "fly-academy":
    case "fly-station":
    case "industry":
    case "hangar-high":
    case "hangar-turrets":
      return HUB_ZONE;
    case "fly-mining":
    case "targeting":
    case "mining":
      return MINING_ZONE;
    case "fly-gunnery":
    case "gunnery": {
      const gunnery = TUTORIAL_LOCAL_REGIONS.find((r) => r.id === "tut-gunnery");
      return gunnery
        ? { x: gunnery.x, y: gunnery.y, r: gunnery.r }
        : { x: TUTORIAL_GUNNERY_CENTER.x, y: TUTORIAL_GUNNERY_CENTER.y, r: 160 };
    }
    case "scan-signature":
      return HUB_ZONE;
    case "fly-signature":
    case "breach-signature":
      return SIGNATURE_ZONE;
    case "fly-gate":
    case "graduation":
      return GATE_ZONE;
    default: {
      const reg = TUTORIAL_LOCAL_REGIONS.find((r) => r.stepId === stepId);
      if (reg) return { x: reg.x, y: reg.y, r: reg.r };
      return { x: 0, y: 0, r: 200 };
    }
  }
}

export function tutorialRegionByStep(stepId: string): TutorialLocalRegion | undefined {
  switch (stepId) {
    case "fly-academy":
    case "fly-station":
    case "industry":
    case "hangar-high":
    case "hangar-turrets":
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.id === "tut-industry");
    case "fly-mining":
    case "targeting":
    case "mining":
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.id === "tut-mining");
    case "fly-gunnery":
    case "gunnery":
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.id === "tut-gunnery");
    case "scan-signature":
    case "fly-signature":
    case "breach-signature":
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.id === "tut-signature");
    default:
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.stepId === stepId);
  }
}
