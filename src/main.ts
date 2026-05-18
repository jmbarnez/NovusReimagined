import { G, Client, AppMode } from "./state.js";
import { buildGalaxy, populateSystem } from "./world-gen.js";
import { makePlayer } from "./player/player-data.js";
import { computeStats } from "./player/player-stats.js";
import { validateFitting } from "./player/player-fitting.js";
import { initInput } from "./input.js";
import { ensureBridgeUI } from "./ui/bridge.js";
import { initSettings } from "./ui/settings.js";
import { SpatialGrid } from "./utils/spatial.js";
import { initGameLoop, enterSpaceMode } from "./game-loop.js";
import { MODULES, MODULE_FLAGS } from "./data/modules.js";
import { ModuleRarity } from "./data/moduleRarity.js";
import { getInstance } from "./utils/items.js";
import { logEvent, initHudOverlay } from "./ui/hud-overlay.js";
import { initBackgroundStars } from "./render/background.js";
import { initPixi, resizePixi, setViewMaskEnabled } from "./pixi.js";
import { initPixiBackground } from "./render/pixi-background.js";
import { initPixiParticles } from "./render/pixi-particles.js";
import { initPixiEntities } from "./render/pixi-entities.js";
import { initPixiPlayer } from "./render/pixi-player.js";

import { showTitleScreen } from "./ui/title-screen.js";
import { C } from "./config/index.js";

/**
 * Main entry point. Orchestrates the robust initialization sequence.
 */
async function boot() {
  try {
    // 1. Core Systems
    G.spatialGrid = new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize);
    initSettings();
    initInput();
    
    // 2. UI Pre-init
    ensureBridgeUI();
    initHudOverlay();

    // 3. World & Player Data
    G.GALAXY = buildGalaxy();
    initBackgroundStars(Client.settings?.backgroundDetail || "high");
    G.P = makePlayer();
    
    const sysIdx = G.P.sysIdx || 0;
    if (!G.GALAXY[sysIdx]) G.P.sysIdx = 0;
    populateSystem(G.GALAXY[G.P.sysIdx]);

    setupPlayerSpawn();
    validatePlayerFitting();
    computeStats();
    clampPlayerVitals();

    // 4. Rendering Engines
    await initPixi();
    initPixiBackground();
    initPixiParticles();
    initPixiEntities();
    initPixiPlayer();
    window.addEventListener("resize", resizePixi);

    // 5. Start unified animation loop (in TITLE mode)
    Client.camx = 0;
    Client.camy = 0;
    initGameLoop();

    // 6. Show Title Screen and handle transition
    const sys = G.GALAXY[G.P.sysIdx];
    showTitleScreen(() => {
      enterSpaceMode();
      setViewMaskEnabled(true);
      if (sys) {
        logEvent(`System entry: ${sys.name}  (SEC ${sys.security.toFixed(1)})`, "system");
      }
    });

  } catch (err) {
    console.error("FATAL BOOT ERROR:", err);
  }
}

function setupPlayerSpawn() {
  if (G.P.pendingHomeSpawn) {
    G.P.pendingHomeSpawn = false;
    G.P.x = 0;
    G.P.y = 0;
    G.P.px = 0;
    G.P.py = 0;
  }
}

function validatePlayerFitting() {
  validateFitting();
  const hasWeapon = G.P.fitting.turret.some((uid: string | null) => {
    if (!uid) return false;
    const inst = getInstance(uid);
    if (!inst) return false;
    const m = MODULES[inst.baseId];
    return m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
  });
  if (!hasWeapon) {
    const firstEmpty = G.P.fitting.turret.findIndex((id: string | null) => id === null);
    if (firstEmpty >= 0) {
      const fallbackUid = `${C.SPAWNING.FALLBACK_WEAPON.uidPrefix}-${Date.now()}`;
      G.P.moduleCargo.push({
        uid: fallbackUid, baseId: C.SPAWNING.FALLBACK_WEAPON.moduleBaseId,
        rarity: ModuleRarity.Stock, itemLevel: C.SPAWNING.FALLBACK_WEAPON.itemLevel,
        durability: C.SPAWNING.FALLBACK_WEAPON.durability, maxDurability: C.SPAWNING.FALLBACK_WEAPON.maxDurability, affixes: [],
      });
      G.P.fitting.turret[firstEmpty] = fallbackUid;
      validateFitting();
    }
  }
}

function clampPlayerVitals() {
  if (G.P.hp > G.P.maxHp) G.P.hp = G.P.maxHp;
  if (G.P.structure > G.P.maxStructure) G.P.structure = G.P.maxStructure;
  if (G.P.structure < 0) G.P.structure = 0;
}

boot();
