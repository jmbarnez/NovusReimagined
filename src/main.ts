import { Client } from "./state.js";
import { WorldAccess, getState } from "./state-access.js";
import { buildGalaxy, populateSystem } from "./world-gen.js";
import { savePlayer } from "./player/player-data.js";
import { initInput } from "./input/index.js";
import { ensureBridgeUI } from "./ui/bridge.js";
import { initSettings } from "./ui/settings/index.js";
import { SpatialGrid } from "./utils/spatial.js";
import { initGameLoop } from "./game-loop.js";
import { initHudOverlay } from "./ui/hud-overlay.js";
import { initBackgroundStars } from "./render/background.js";
import { initPixi, renderPixi, resizePixi, entityLayer, effectLayer, stationLayer } from "./pixi.js";
import { initPixiBackground, updatePixiBackground } from "./render/pixi-background.js";
import { initPixiParticles } from "./render/pixi-particles.js";
import { initPixiEntities } from "./render/enemy/index.js";
import { initPixiPlayer } from "./render/player/index.js";
import { initPixiCombat } from "./render/combat/index.js";
import { initPixiEffects } from "./render/fx/index.js";
import { initVignette } from "./render/pixi-vignette.js";
import { initPixiHUD } from "./render/pixi-hud-core.js";
import { initPixiTargetArrows } from "./render/pixi-target-arrows.js";
import { initPixiMaps } from "./render/pixi-maps.js";
import { initPixiMinimap } from "./render/pixi-minimap.js";
import { initPixiCelestial } from "./render/celestial/index.js";

import { bindTitleScreenEvents, restoreTitleScreen } from "./ui/title-screen.js";
import { localizeBootScreen, markBootPhase, registerLoadingConsole, transitionToTitleScreen } from "./ui/loading-screen.js";
import { migrateLegacySave } from "./data/profiles.js";
import { C } from "./config/index.js";

/**
 * Main entry point. Orchestrates the robust initialization sequence.
 */
async function boot() {
  try {
    // 0. Theme & Settings first so the boot screen never flashes default colors
    initSettings();
    localizeBootScreen();

    // 1. Core Systems
    markBootPhase("start");
    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));
    migrateLegacySave();
    initInput();
    registerLoadingConsole();

    // 2. UI Pre-init
    ensureBridgeUI();
    initHudOverlay();
    markBootPhase("ui");

    // 3. World Data (no dummy player — player is installed when entering gameplay)
    WorldAccess.setGalaxy(buildGalaxy());
    initBackgroundStars(Client.settings?.backgroundDetail || "high");
    populateSystem(getState().GALAXY[0]);

    markBootPhase("world");

    // 4. Rendering Engines
    await initPixi();
    initPixiBackground();
    initVignette();

    // Pre-render space background so the cockpit window shows stars/nebula
    // immediately instead of black during boot.
    const sys = getState().GALAXY[0];
    if (sys) {
      updatePixiBackground(performance.now(), 0, 0);
      if (stationLayer) initPixiCelestial(stationLayer, sys);
      renderPixi();
    }

    // Reveal page and switch straight to title screen — skip loading UI during boot
    document.documentElement.style.visibility = "visible";
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.opacity = "1";
    // Don't call transitionToTitleScreen() - the HTML already has the correct structure
    // Just bind events to the existing buttons
    bindTitleScreenEvents();
    // Manually add the class to show buttons and hide loading elements
    loadingEl?.classList.add("ld-title-mode");

    initPixiParticles();
    initPixiEntities();
    initPixiPlayer();
    if (entityLayer) initPixiCombat(entityLayer);
    if (effectLayer) initPixiEffects(effectLayer);
    initPixiHUD();
    initPixiTargetArrows();
    initPixiMinimap();
    initPixiMaps();
    window.addEventListener("resize", resizePixi);

    // 5. Start unified animation loop (in TITLE mode)
    Client.camx = 0;
    Client.camy = 0;
    initGameLoop();
    markBootPhase("pixi");

  } catch (err) {
    console.error("FATAL BOOT ERROR:", err);
  }
}

boot();

window.addEventListener("beforeunload", () => {
  if (Client.gameStarted) {
    savePlayer();
  }
});
