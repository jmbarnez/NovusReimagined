import {
  _G as G,
  type GameState,
  type Player,
  type MiningLaserState,
  type SalvagerState,
  type TractorState,
} from "../../state.js";

// ─── Read-only snapshot interface ────────────────────────────────────────────

export interface ReadOnlyState {
  player: Player;
  players: Map<string, Player>;
  bullets: GameState["bullets"];
  enemyBullets: GameState["enemyBullets"];
  beams: GameState["beams"];
  particles: GameState["particles"];
  shockwaves: GameState["shockwaves"];
  floatTexts: GameState["floatTexts"];
  trails: GameState["trails"];
  wreckPieces: GameState["wreckPieces"];
  salvagePickups: GameState["salvagePickups"];
  impactDecals: GameState["impactDecals"];
  miningLaser: MiningLaserState | null | undefined;
  salvager: SalvagerState | null | undefined;
  tractor: TractorState | null | undefined;
  warpCooldown: number;
  warpTargetIdx: number;
  spatialGrid: GameState["spatialGrid"];
  STARS: GameState["STARS"];
  STARS_FAR: GameState["STARS_FAR"];
  STARS_NEAR: GameState["STARS_NEAR"];
  DUST: GameState["DUST"];
  GALAXY: GameState["GALAXY"];
  _statsCache: GameState["_statsCache"];
  pendingEffects: GameState["pendingEffects"];
}

/**
 * Returns a read-only view of the current game state.
 * The returned object references live arrays — do not mutate them directly.
 * Use the domain-specific accessors below for mutations.
 */
export function getState(): ReadOnlyState {
  return {
    player: G.P,
    players: G.players,
    bullets: G.bullets,
    enemyBullets: G.enemyBullets,
    beams: G.beams,
    particles: G.particles,
    shockwaves: G.shockwaves,
    floatTexts: G.floatTexts,
    trails: G.trails,
    wreckPieces: G.wreckPieces,
    salvagePickups: G.salvagePickups,
    impactDecals: G.impactDecals,
    miningLaser: (G.P?.miningLaser as MiningLaserState | undefined) ?? null,
    salvager: G.P?.salvager ?? null,
    tractor: G.P?.tractor ?? null,
    warpCooldown: G.P?.warpCooldown ?? 0,
    warpTargetIdx: G.P?.warpTargetIdx ?? -1,
    spatialGrid: G.spatialGrid,
    STARS: G.STARS,
    STARS_FAR: G.STARS_FAR,
    STARS_NEAR: G.STARS_NEAR,
    DUST: G.DUST,
    GALAXY: G.GALAXY,
    get _statsCache() { return G._statsCache; },
    set _statsCache(value) { G._statsCache = value; },
    pendingEffects: G.pendingEffects,
  };
}
