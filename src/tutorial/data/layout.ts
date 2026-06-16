import { t } from "../i18n/index.js";
import { C } from "../config/index.js";

export const TUTORIAL_SUN_DIR = { x: 1, y: 0 } as const;
export const TUTORIAL_SECTOR = { x: 0, y: 0, ring: 0 } as const;

/** Station (orbital outpost near the planet). */
export const TUTORIAL_STATION = { x: -1550, y: -850 } as const;
export const TUTORIAL_HUB = TUTORIAL_STATION;
export const TUTORIAL_APPROACH_TARGET = TUTORIAL_STATION;

const TUTORIAL_SPAWN_DIST_FROM_HUB = 2500;

/** Spawn on the opposite side of the belt from the station. */
export const TUTORIAL_SPAWN = {
  x: Math.round(TUTORIAL_STATION.x + TUTORIAL_SPAWN_DIST_FROM_HUB),
  y: Math.round(TUTORIAL_STATION.y),
} as const;

export function getTutorialSunWorldPos() {
  return { x: 0, y: 0 };
}

export function shouldRelocateTutorialStart(x: number, y: number) {
  const sun = getTutorialSunWorldPos();
  const d = Math.hypot(x - sun.x, y - sun.y);
  return d < 600;
}

export const TUTORIAL_FLIGHT_DECK = { x: -200, y: -100 } as const;
export const TUTORIAL_FLIGHT_DECK_R = 200;
export const TUTORIAL_START_PLANET = { x: -2200, y: -500 } as const;
/** Thick asteroid belt ring far from the star. */
export const TUTORIAL_BELT_RING_CENTER = { x: 0, y: 0 } as const;
export const TUTORIAL_BELT_RING_RADIUS = 3600;
export const TUTORIAL_BELT_THICKNESS = 800;

/** Mining waypoint — a specific point on the ring for nav/track targets. */
export const TUTORIAL_BELT_CENTER = { x: 0, y: 3600 } as const;
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
    points: [TUTORIAL_STATION, TUTORIAL_BELT_CENTER],
    halfWidth: 110,
    activeForSteps: ["fly-mining"],
  },
  {
    id: "spoke-mining-return",
    points: [TUTORIAL_BELT_CENTER, TUTORIAL_STATION],
    halfWidth: 110,
    activeForSteps: ["fly-station"],
  },
  {
    id: "spoke-gunnery",
    points: [TUTORIAL_STATION, { x: TUTORIAL_TRAINING_SITE_X, y: TUTORIAL_TRAINING_SITE_Y }],
    halfWidth: 120,
    activeForSteps: ["fly-gunnery"],
  },
  {
    id: "spoke-gate",
    points: [TUTORIAL_STATION, TUTORIAL_GATE],
    halfWidth: 120,
    activeForSteps: ["fly-gate"],
  },
];

export function getTutorialTrackById(id: string): TutorialTrackSegment | undefined {
  return TUTORIAL_TRACKS.find((t) => t.id === id);
}

export function getActiveTutorialTracks(stepId: string): TutorialTrackSegment[] {
  return TUTORIAL_TRACKS.filter((t) => t.activeForSteps.includes(stepId));
}

export function getTutorialTrackForNav(stepId: string): TutorialTrackSegment | undefined {
  const active = getActiveTutorialTracks(stepId);
  return active[0];
}

export function trackTotalArcLength(track: TutorialTrackSegment): number {
  let len = 0;
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export interface TrackProximity {
  dist: number;
  inside: boolean;
  arcLength: number;
  tangentAngle: number;
}

export function distToTrack(track: TutorialTrackSegment, px: number, py: number): TrackProximity {
  let bestDist = Infinity;
  let bestArc = 0;
  let bestTangent = 0;
  let inside = false;

  let arc = 0;
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen <= 0) continue;

    const t = Math.max(0, Math.min(1, ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / (segLen * segLen)));
    const cx = a.x + (b.x - a.x) * t;
    const cy = a.y + (b.y - a.y) * t;
    const d = Math.hypot(px - cx, py - cy);

    if (d < bestDist) {
      bestDist = d;
      bestArc = arc + t * segLen;
      bestTangent = Math.atan2(b.y - a.y, b.x - a.x);
      inside = d <= track.halfWidth;
    }
    arc += segLen;
  }

  return { dist: bestDist, inside, arcLength: bestArc, tangentAngle: bestTangent };
}

export function trackArcLengthProgress(track: TutorialTrackSegment, px: number, py: number): number {
  const total = trackTotalArcLength(track);
  if (total <= 0) return 0;
  const prox = distToTrack(track, px, py);
  return prox.arcLength / total;
}

export function snapToTrackCenterline(track: TutorialTrackSegment, px: number, py: number): { x: number; y: number } {
  let bestDist = Infinity;
  let bestX = px;
  let bestY = py;

  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    const segLenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (segLenSq <= 0) continue;
    const t = Math.max(0, Math.min(1, ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / segLenSq));
    const cx = a.x + (b.x - a.x) * t;
    const cy = a.y + (b.y - a.y) * t;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestDist) {
      bestDist = d;
      bestX = cx;
      bestY = cy;
    }
  }

  return { x: bestX, y: bestY };
}

/** True if point is inside the tutorial nav bounds (stations, gate, and tracks). */
export function inTutorialNavBounds(px: number, py: number): boolean {
  for (const s of TUTORIAL_TRACKS) {
    if (distToTrack(s, px, py).inside) return true;
  }
  const HUB_ZONE = { x: TUTORIAL_HUB.x, y: TUTORIAL_HUB.y, r: 280 } as const;
  const MINING_ZONE = { x: TUTORIAL_BELT_CENTER.x, y: TUTORIAL_BELT_CENTER.y, r: TUTORIAL_MINING_ZONE_R } as const;
  const GATE_ZONE = { x: TUTORIAL_GATE.x, y: TUTORIAL_GATE.y, r: 280 } as const;
  for (const z of [HUB_ZONE, MINING_ZONE, GATE_ZONE]) {
    if (Math.hypot(px - z.x, py - z.y) < z.r) return true;
  }
  return false;
}

export function tutorialRegionZone(id: string): { x: number; y: number; r: number } | undefined {
  const r = TUTORIAL_LOCAL_REGIONS.find((z) => z.id === id);
  return r ? { x: r.x, y: r.y, r: r.r } : undefined;
}

export function tutorialRegionByStep(stepId: string): TutorialLocalRegion | undefined {
  return TUTORIAL_LOCAL_REGIONS.find((z) => z.stepId === stepId);
}

export function getGateControlHint(trackId: string): string {
  switch (trackId) {
    case "approach": return "brakeOvershoot";
    case "spoke-mining": return "gateSteady";
    case "spoke-mining-return": return "gateSteady";
    case "spoke-gunnery": return "gateMomentum";
    case "spoke-gate": return "gateSteady";
    default: return "";
  }
}

export function gatePillarPositions(gate: { x: number; y: number; angle: number; halfWidth: number }) {
  const px = Math.cos(gate.angle + Math.PI / 2) * gate.halfWidth;
  const py = Math.sin(gate.angle + Math.PI / 2) * gate.halfWidth;
  return [
    { x: gate.x + px, y: gate.y + py },
    { x: gate.x - px, y: gate.y - py },
  ];
}

export function detectGateCrossing(
  gate: { x: number; y: number; angle: number; halfWidth: number },
  x1: number, y1: number, x2: number, y2: number,
  vx: number, vy: number,
): boolean {
  const nx = Math.cos(gate.angle);
  const ny = Math.sin(gate.angle);
  const d1 = (x1 - gate.x) * nx + (y1 - gate.y) * ny;
  const d2 = (x2 - gate.x) * nx + (y2 - gate.y) * ny;
  if (d1 * d2 >= 0) return false;
  const t = d1 / (d1 - d2);
  const cx = x1 + (x2 - x1) * t;
  const cy = y1 + (y2 - y1) * t;
  const perpX = -ny * gate.halfWidth;
  const perpY = nx * gate.halfWidth;
  const dist = Math.abs((cx - gate.x) * (-ny) + (cy - gate.y) * nx);
  if (dist > gate.halfWidth) return false;
  const dot = vx * nx + vy * ny;
  return dot > 0;
}

// ── Types (kept for warp gate rendering compatibility) ─────────────────────

export interface TutorialBoostGate {
  id: string;
  trackId: string;
  x: number;
  y: number;
  angle: number;
  halfWidth: number;
}
