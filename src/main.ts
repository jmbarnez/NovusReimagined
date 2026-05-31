import { Client } from "./state.js";
import { WorldAccess, PlayerAccess, getState } from "./state-access.js";
import { buildGalaxy, populateSystem } from "./world-gen.js";
import { makePlayer } from "./player/player-data.js";
import { computeStats } from "./player/player-stats.js";
import { initInput } from "./input.js";
import { ensureBridgeUI } from "./ui/bridge.js";
import { initSettings } from "./ui/settings/index.js";
import { SpatialGrid } from "./utils/spatial.js";
import { initGameLoop } from "./game-loop.js";
import { initHudOverlay } from "./ui/hud-overlay.js";
import { initBackgroundStars } from "./render/background.js";
import { initPixi, resizePixi } from "./pixi.js";
import { initPixiBackground } from "./render/pixi-background.js";
import { initPixiParticles } from "./render/pixi-particles.js";
import { initPixiEntities } from "./render/pixi-entities.js";
import { initPixiPlayer } from "./render/pixi-player.js";
import { initVignette } from "./render/pixi-vignette.js";

import { bindTitleScreenEvents } from "./ui/title-screen.js";
import { markBootPhase, registerLoadingConsole, transitionToTitleScreen } from "./ui/loading-screen.js";
import { initPlayerGameSetup } from "./player/init.js";
import { migrateLegacySave } from "./data/profiles.js";
import { C } from "./config/index.js";

/**
 * Main entry point. Orchestrates the robust initialization sequence.
 */
async function boot() {
  try {
    // 1. Core Systems
    markBootPhase("start");
    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));
    initSettings();
    migrateLegacySave();
    initInput();
    registerLoadingConsole();

    // 2. UI Pre-init
    ensureBridgeUI();
    initHudOverlay();
    markBootPhase("ui");

    // 3. World & Player Data
    WorldAccess.setGalaxy(buildGalaxy());
    initBackgroundStars(Client.settings?.backgroundDetail || "high");
    WorldAccess.initPlayer(makePlayer());

    const sysIdx = getState().player.sysIdx || 0;
    if (!getState().GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
    populateSystem(getState().GALAXY[getState().player.sysIdx]);

    initPlayerGameSetup();
    computeStats();

    markBootPhase("world");

    // 4. Rendering Engines
    await initPixi();
    initPixiBackground();
    initVignette();
    initPixiParticles();
    initPixiEntities();
    initPixiPlayer();
    window.addEventListener("resize", resizePixi);

    // 5. Start unified animation loop (in TITLE mode)
    Client.camx = 0;
    Client.camy = 0;
    initGameLoop();
    markBootPhase("pixi");

    // 6. Transform loading screen to title screen
    transitionToTitleScreen();
    bindTitleScreenEvents();

  } catch (err) {
    console.error("FATAL BOOT ERROR:", err);
  }
}

boot();
