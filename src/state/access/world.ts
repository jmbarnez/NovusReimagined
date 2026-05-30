import { _G, type GameState, type Player } from "../../state.js";
import { installLocalPlayer, LOCAL_PLAYER_ID } from "../../player-registry.js";

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
};
