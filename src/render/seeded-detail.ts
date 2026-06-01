import { mkRng, rf } from "../utils/math.js";
import { TAU } from "../constants.js";

// Lazy memoized seeded detail bundles. Stored on the host object as a
// non-enumerable map so we don't interfere with serialization.
const DETAIL_KEY = "_seededDetail";

interface SeededDetailHost {
  id?: string;
  idx?: number;
  _seededDetail?: Record<string, unknown>;
}

export function getSeededDetail<T>(host: SeededDetailHost | null | undefined, kind: string, factory: (rng: () => number) => T): T {
  if (!host) return factory(Math.random);
  let bag = host._seededDetail;
  if (!bag) { bag = {}; host._seededDetail = bag; }
  if (bag[kind]) return bag[kind] as T;
  const rng = mkRng((host.id || host.idx || "anon") + ":" + kind);
  const v = factory(rng);
  bag[kind] = v;
  return v;
}

/** Build a closed jagged polygon (centered at origin) for damage decals & shrapnel. */
export function jaggedPoly(rng: () => number, baseR: number, jitter: number, nVerts: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < nVerts; i++) {
    const a = (i / nVerts) * TAU + rf(rng, -0.18, 0.18);
    const r = baseR * (1 - jitter * 0.5 + rng() * jitter);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/**
 * Compute the local-frame sun direction for an entity rotated by `entityRot`.
 * `sysSunDir` is the world-space angle pointing from the entity TOWARD the sun.
 */
export function localSunVec(sysSunDir: number, entityRot = 0): { dx: number; dy: number } {
  const a = sysSunDir - entityRot;
  return { dx: Math.cos(a), dy: Math.sin(a) };
}

// ── Star class color tables ────────────────────────────────────────────────
// Used to derive ambient tint from a system's seeded star.
// Values intentionally subtle — this multiplies over the entire world layer.
const STAR_TINTS: Record<string, [number, number, number]> = {
  O: [180, 200, 255],
  B: [200, 220, 255],
  A: [235, 240, 255],
  F: [255, 250, 230],
  G: [255, 240, 210],
  K: [255, 210, 170],
  M: [255, 170, 140],
};

export function tintFor(starClass: string): [number, number, number] {
  return STAR_TINTS[starClass] || STAR_TINTS.G;
}
