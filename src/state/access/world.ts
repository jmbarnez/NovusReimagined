import { _G, type GameState, type Player } from "../../state.js";
import { installLocalPlayer, LOCAL_PLAYER_ID } from "../../player-registry.js";
import type { GameEffect } from "../../state/types/combat.js";
import type { ComputedStats } from "../../player/player-stats.js";

// ─── World accessors ─────────────────────────────────────────────────────────

export const WorldAccess = {
  /** Set spatial grid. */
  setSpatialGrid(grid: GameState["spatialGrid"]) {
    _G.spatialGrid = grid;
  },

  /** Set star field (medium parallax layer). */
  setStars(stars: GameState["STARS"]) {
    _G.STARS = stars;
  },

  /** Set far star field (slow parallax layer). */
  setStarsFar(stars: GameState["STARS_FAR"]) {
    _G.STARS_FAR = stars;
  },

  /** Set near star field (fast parallax layer). */
  setStarsNear(stars: GameState["STARS_NEAR"]) {
    _G.STARS_NEAR = stars;
  },

  /** Set dust particle field. */
  setDust(dust: GameState["DUST"]) {
    _G.DUST = dust;
  },

  /** Set galaxy systems array (boot-time init). */
  setGalaxy(galaxy: GameState["GALAXY"]) {
    _G.GALAXY = galaxy;
  },

  /** Initialize player state (boot-time init). */
  initPlayer(player: Player) {
    installLocalPlayer(player, player.netId ?? LOCAL_PLAYER_ID);
  },

  setHiddenSiteState(systemIdx: number, siteId: string, state: "hidden" | "detected" | "resolved" | "cleared") {
    const sys = _G.GALAXY[systemIdx];
    const site = sys?.hiddenSites?.find((entry) => entry.id === siteId);
    if (site) site.state = state;
  },

  depleteAsteroid(systemIdx: number, asteroidId: string, respawnTimer: number): boolean {
    const sys = _G.GALAXY[systemIdx];
    const asteroid = sys?.asteroids.find((entry) => entry.id === asteroidId);
    if (!asteroid) return false;
    asteroid.depleted = true;
    asteroid.hp = 0;
    asteroid.respawnTimer = respawnTimer;
    return true;
  },

  /** Queue a visual/audio effect for the current frame. */
  queueEffect(effect: GameEffect) {
    _G.pendingEffects.push(effect);
  },

  /** Clear all pending effects (consumed by renderer / network sync). */
  clearEffects() {
    _G.pendingEffects.length = 0;
  },

  /** Set or clear the cached computed-stats snapshot. */
  setStatsCache(stats: ComputedStats | null) {
    _G._statsCache = stats;
  },

  /** Clear the cached computed-stats snapshot. */
  clearStatsCache() {
    _G._statsCache = null;
  },

  /** Get the cached computed-stats snapshot. */
  getStatsCache(): ComputedStats | null {
    return _G._statsCache;
  },
};
