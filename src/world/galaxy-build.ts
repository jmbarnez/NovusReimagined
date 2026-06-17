import { mkRng, rf, ri } from "../utils/math.js";
import { TUTORIAL_SECTOR } from "../data/tutorial-layout.js";
import { TAU } from "../constants.js";
import { C } from "../config/index.js";
import type { System } from "../types/system.js";
import { SUN_WORLD_DIST } from "../utils/sun-position.js";

export { TUTORIAL_SECTOR } from "../data/tutorial-layout.js";

export type NebulaArchetype = "pillars" | "wisps" | "dense" | "void" | "dust-lane";
export type StarClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";

const STAR_TINTS: Record<StarClass, [number, number, number]> = {
  O: [180, 200, 255],
  B: [200, 220, 255],
  A: [235, 240, 255],
  F: [255, 250, 230],
  G: [255, 240, 210],
  K: [255, 210, 170],
  M: [255, 170, 140],
};

function tintFor(starClass: StarClass): [number, number, number] {
  return STAR_TINTS[starClass];
}

function pickArchetype(rng: () => number, ring: number): NebulaArchetype {
  const t = rng();
  if (ring === 0) return t < 0.5 ? "void" : t < 0.85 ? "dust-lane" : "wisps";
  if (ring === 1) return t < 0.25 ? "void" : t < 0.55 ? "dust-lane" : t < 0.8 ? "wisps" : "pillars";
  if (ring === 2) return t < 0.15 ? "void" : t < 0.4 ? "wisps" : t < 0.7 ? "pillars" : "dense";
  return t < 0.1 ? "void" : t < 0.35 ? "wisps" : t < 0.7 ? "pillars" : "dense";
}

function pickStarClass(rng: () => number, ring: number): StarClass {
  const t = rng();
  if (ring === 0) return t < 0.6 ? "G" : "F";
  if (ring === 1) return t < 0.35 ? "G" : t < 0.55 ? "F" : t < 0.75 ? "K" : t < 0.9 ? "A" : "M";
  if (t < 0.15) return "M";
  if (t < 0.35) return "K";
  if (t < 0.55) return "G";
  if (t < 0.7) return "F";
  if (t < 0.85) return "A";
  if (t < 0.95) return "B";
  return "O";
}

/** Index of the post-tutorial hub system (nearest ring-1 neighbor of sys-0). */
export let NOVUS_PRIME_IDX = -1;

export function getNovusPrimeIdx(): number {
  return NOVUS_PRIME_IDX;
}

function makeGalaxySystem(
  idx: number,
  name: string,
  mapX: number,
  mapY: number,
  security: number,
  ring: number,
): System {
  const visRng = mkRng(`sys-vis-${idx}`);
  const archetype = pickArchetype(visRng, ring);
  const starClass = idx === 0 ? "B" : pickStarClass(visRng, ring);
  const sunDir = idx === 0 ? 0 : visRng() * TAU;
  const sunDist = idx === 0 ? 0 : SUN_WORLD_DIST;
  const tintRGB = tintFor(starClass);
  return {
    idx, id: `sys-${idx}`,
    name,
    security: Math.round(security * 10) / 10,
    mapX, mapY,
    ring,
    links: [],
    _ready: false,
    asteroids: [], enemies: [], gates: [], stations: [], planets: [],
    nebulaHues: (() => {
      const f = mkRng(`sys-hue-${idx}`);
      const h1 = ri(f, 0, 360);
      const h2 = (h1 + 40 + ri(f, 60, 180)) % 360;
      const h3 = (h1 + 40 + ri(f, 180, 300)) % 360;
      return [h1, h2, h3];
    })(),
    starHue: ri(mkRng(`sys-shue-${idx}`), 0, 360),
    archetype,
    starClass,
    sunDir,
    sunDist,
    tintRGB,
    flareTint: 0,
    flareTimer: rf(visRng, 18, 55),
  };
}

export function getSectorBounds(idx: number): { inner: number; outer: number } {
  const sec = C.WORLD.CONCENTRIC.sectors.find((s) => s.idx === idx);
  if (sec) {
    return { inner: 0, outer: sec.r };
  }
  // Fallback for Sector 0 / S.T.A.R.T
  return { inner: 0, outer: 9000 };
}

/** Tier 1 galaxy: cadet training system + Novus Prime hub only. */
export function buildGalaxy(): System[] {
  const cadet = makeGalaxySystem(0, "S.T.A.R.T System", -420, 0, 1.0, 0);
  const prime = makeGalaxySystem(1, "Novus Prime Core", 420, 0, 0.8, 1);
  prime._isNovusPrime = true;
  const innerBelt = makeGalaxySystem(2, "Inner Belt", 570, 0, 0.5, 2);
  const outerBelt = makeGalaxySystem(3, "Outer Belt", 720, 0, 0.2, 3);
  const deepSpace = makeGalaxySystem(4, "Deep Space", 870, 0, 0.0, 4);

  cadet.links = [1];
  prime.links = [];
  NOVUS_PRIME_IDX = 1;
  return [cadet, prime, innerBelt, outerBelt, deepSpace];
}
