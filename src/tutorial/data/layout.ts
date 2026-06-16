/** Single source of truth for S.T.A.R.T tutorial sector layout. */

import { C } from "../../config/index.js";
import {
  resolveTutorialGateHint,
  type TutorialGateHintKey,
} from "./controls.js";
import { t } from "../../utils/i18n.js";

export const TUTORIAL_SUN_DIR = 0;
const TUTORIAL_SUN_DIST = 0;

export const TUTORIAL_SECTOR = {
  x: 0,
  y: 0,
  radius: 4500,
  name: t("world.sector.start"),
  security: 1.0,
} as const;

export const TUTORIAL_STATION = { x: -1550, y: -850 } as const;
export const TUTORIAL_HUB = TUTORIAL_STATION;
export const TUTORIAL_APPROACH_TARGET = TUTORIAL_STATION;

const TUTORIAL_SPAWN_DIST_FROM_HUB = 2500;
const TUTORIAL_SPAWN_SIDE = 0;

export function getTutorialSunWorldPos(): { x: number; y: number } {
  return {
    x: Math.cos(TUTORIAL_SUN_DIR) * TUTORIAL_SUN_DIST,
    y: Math.sin(TUTORIAL_SUN_DIR) * TUTORIAL_SUN_DIST,
  };
}

export const TUTORIAL_SPAWN = (() => {
  const towardSun = TUTORIAL_SUN_DIR;
  const perp = TUTORIAL_SUN_DIR + Math.PI / 2;
  return {
    x: Math.round(Math.cos(towardSun) * TUTORIAL_SPAWN_DIST_FROM_HUB + Math.cos(perp) * TUTORIAL_SPAWN_SIDE),
    y: Math.round(Math.sin(towardSun) * TUTORIAL_SPAWN_DIST_FROM_HUB + Math.sin(perp) * TUTORIAL_SPAWN_SIDE),
  };
})();

export function shouldRelocateTutorialStart(x: number, y: number): boolean {
  if (Math.hypot(x - TUTORIAL_SPAWN.x, y - TUTORIAL_SPAWN.y) > 900) return true;
  const sun = getTutorialSunWorldPos();
  if (Math.hypot(x - sun.x, y - sun.y) < 400) return true;
  return false;
}

export const TUTORIAL_FLIGHT_DECK = { x: -200, y: -100 } as const;
export const TUTORIAL_FLIGHT_DECK_R = 200;
export const TUTORIAL_START_PLANET = { x: -2200, y: -500 } as const;
/** Thin asteroid belt ring around the star (centered on sun). */
export const TUTORIAL_BELT_RING_CENTER = { x: 0, y: 0 } as const;
export const TUTORIAL_BELT_RING_RADIUS = 1800;
export const TUTORIAL_BELT_THICKNESS = 200;

/** Mining waypoint — a specific point on the ring for nav/track targets. */
export const TUTORIAL_BELT_CENTER = { x: 0, y: 1800 } as const;
export const TUTORIAL_MINING_ZONE_R = 600;
export const TUTORIAL_GUNNERY_CENTER = { x: 2200, y: 1600 } as const;
export const TUTORIAL_TRAINING_SITE_X = 2000;
export const TUTORIAL_TRAINING_SITE_Y = 2900;
export const TUTORIAL_GATE = { x: 2300, y: 200 } as const;

export interface TutorialLocalRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  stepId?: string;
}

export const TUTORIAL_LOCAL_REGIONS: TutorialLocalRegion[] = [
  { id: "tut-flight", name: t("world.region.flightDeck"), x: TUTORIAL_FLIGHT_DECK.x, y: TUTORIAL_FLIGHT_DECK.y, r: TUTORIAL_FLIGHT_DECK_R, stepId: "fly-academy" },
  { id: "tut-mining", name: t("world.region.miningRange"), x: TUTORIAL_BELT_CENTER.x, y: TUTORIAL_BELT_CENTER.y, r: TUTORIAL_MINING_ZONE_R, stepId: "targeting" },
  { id: "tut-industry", name: t("world.region.industryBench"), x: TUTORIAL_STATION.x + 420, y: TUTORIAL_STATION.y + 120, r: 280, stepId: "industry" },
  { id: "tut-gunnery", name: t("world.region.gunneryBay"), x: 2200, y: 1600, r: 160, stepId: "gunnery" },
];

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
      TUTORIAL_FLIGHT_DECK,
      TUTORIAL_STATION,
    ],
    halfWidth: 120,
    activeForSteps: ["fly-academy"],
  },
  {
    id: "spoke-mining",
    points: [HUB, TUTORIAL_BELT_CENTER],
    halfWidth: 110,
    activeForSteps: ["fly-mining"],
  },
  {
    id: "spoke-mining-return",
    points: [TUTORIAL_BELT_CENTER, HUB],
    halfWidth: 110,
    activeForSteps: ["fly-station"],
  },
  {
    id: "spoke-gunnery",
    points: [HUB, TUTORIAL_GUNNERY_CENTER],
    halfWidth: 110,
    activeForSteps: ["fly-gunnery"],
  },
  {
    id: "spoke-gate",
    points: [HUB, TUTORIAL_GATE],
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

export function snapToTrackCenterline(track: TutorialTrackSegment, px: number, py: number): { x: number; y: number } {
  const prox = distToTrack(track, px, py);
  return { x: prox.closestX, y: prox.closestY };
}

const HUB_ZONE = { x: TUTORIAL_HUB.x, y: TUTORIAL_HUB.y, r: 280 } as const;
const MINING_ZONE = { x: TUTORIAL_BELT_CENTER.x, y: TUTORIAL_BELT_CENTER.y, r: TUTORIAL_MINING_ZONE_R } as const;
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
    default:
      return TUTORIAL_LOCAL_REGIONS.find((r) => r.stepId === stepId);
  }
}
