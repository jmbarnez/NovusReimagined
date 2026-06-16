import { t } from "../../utils/i18n.js";
import { C } from "../../config/index.js";

const T = C.WORLD.TUTORIAL;

export const TUTORIAL_SUN_DIR = { x: 1, y: 0 } as const;
export const TUTORIAL_SECTOR = { x: 0, y: 0, radius: T.sectorRadius, ring: 0 } as const;

/** Station (orbital outpost near the planet). */
export const TUTORIAL_STATION = { x: T.station.x, y: T.station.y } as const;
export const TUTORIAL_HUB = TUTORIAL_STATION;

/** Spawn further from the sun in the same direction as the station. */
export const TUTORIAL_SPAWN = { x: T.spawn.x, y: T.spawn.y } as const;

export function getTutorialSunWorldPos() {
  return { x: 0, y: 0 };
}

export function shouldRelocateTutorialStart(x: number, y: number) {
  const sun = getTutorialSunWorldPos();
  const d = Math.hypot(x - sun.x, y - sun.y);
  return d < 600;
}

export const TUTORIAL_START_PLANET = { x: T.planet.x, y: T.planet.y } as const;

/** Massive asteroid belt ring around the star for the tutorial (stress-test culling). */
export const TUTORIAL_BELT_RING_CENTER = { x: T.belt.ringCenter.x, y: T.belt.ringCenter.y } as const;
export const TUTORIAL_BELT_RING_RADIUS = T.belt.ringRadius;
export const TUTORIAL_BELT_THICKNESS = T.belt.thickness;

/** Mining waypoint — centered in the belt along the station direction. */
export const TUTORIAL_BELT_CENTER = { x: TUTORIAL_BELT_RING_CENTER.x - TUTORIAL_BELT_RING_RADIUS, y: 0 } as const;
export const TUTORIAL_MINING_ZONE_R = T.miningZoneR;
export const TUTORIAL_GUNNERY_CENTER = { x: T.gunnery.x, y: T.gunnery.y } as const;
export const TUTORIAL_TRAINING_SITE_X = T.gunnery.x;
export const TUTORIAL_TRAINING_SITE_Y = T.gunnery.y;

export const TUTORIAL_GATE = { x: T.gate.x, y: T.gate.y } as const;

export interface TutorialLocalRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  stepId?: string;
}

export const TUTORIAL_LOCAL_REGIONS: TutorialLocalRegion[] = [
  { id: "tut-hub", name: t("world.location.academy"), x: TUTORIAL_HUB.x, y: TUTORIAL_HUB.y, r: 280, stepId: "hangar-high" },
  { id: "tut-mining", name: t("world.region.miningRange"), x: TUTORIAL_BELT_CENTER.x, y: TUTORIAL_BELT_CENTER.y, r: TUTORIAL_MINING_ZONE_R, stepId: "targeting" },
  { id: "tut-gunnery", name: t("world.region.gunneryBay"), x: TUTORIAL_GUNNERY_CENTER.x, y: TUTORIAL_GUNNERY_CENTER.y, r: 160, stepId: "gunnery" },
  { id: "tut-gate", name: t("world.region.gateRange"), x: TUTORIAL_GATE.x, y: TUTORIAL_GATE.y, r: 400, stepId: "fly-gate" },
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
    points: [TUTORIAL_SPAWN, TUTORIAL_STATION],
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
    points: [
      TUTORIAL_STATION,
      { x: TUTORIAL_TRAINING_SITE_X, y: TUTORIAL_TRAINING_SITE_Y },
    ],
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

export function tutorialRegionZone(id: string): { x: number; y: number; r: number } {
  const r = TUTORIAL_LOCAL_REGIONS.find((z) => z.id === id);
  if (!r) throw new Error(`Unknown tutorial region: ${id}`);
  return { x: r.x, y: r.y, r: r.r };
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
