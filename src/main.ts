import { Asteroid } from "./types/world.js";
import { G, Client } from "./state.js";
import { WorldAccess, PlayerAccess } from "./state-access.js";
import { buildGalaxy, populateSystem } from "./world-gen.js";
import { makePlayer, loadPlayer, savePlayer } from "./player/player-data.js";
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
import { initPixi, resizePixi } from "./pixi.js";
import { initPixiBackground } from "./render/pixi-background.js";
import { initPixiParticles } from "./render/pixi-particles.js";
import { initPixiEntities } from "./render/pixi-entities.js";
import { initPixiPlayer } from "./render/pixi-player.js";
import { initVignette } from "./render/pixi-vignette.js";

import { showTitleScreen } from "./ui/title-screen.js";
import { C } from "./config/index.js";

/**
 * Main entry point. Orchestrates the robust initialization sequence.
 */
async function boot() {
  try {
    // 1. Core Systems
    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));
    initSettings();
    initInput();
    
    // 2. UI Pre-init
    ensureBridgeUI();
    initHudOverlay();

    // 3. World & Player Data
    WorldAccess.setGalaxy(buildGalaxy());
    initBackgroundStars(Client.settings?.backgroundDetail || "high");
    WorldAccess.initPlayer(makePlayer());
    
    const sysIdx = G.P.sysIdx || 0;
    if (!G.GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
    populateSystem(G.GALAXY[G.P.sysIdx]);

    setupPlayerSpawn();
    validatePlayerFitting();
    computeStats();
    clampPlayerVitals();

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

    // 6. Show Title Screen and handle transition
    showTitleScreen(
      // onContinue
      () => {
        const savedPlayer = loadPlayer();
        WorldAccess.initPlayer(savedPlayer);

        const sysIdx = G.P.sysIdx || 0;
        if (!G.GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
        populateSystem(G.GALAXY[G.P.sysIdx]);

        validatePlayerFitting();
        computeStats();
        clampPlayerVitals();

        Client.camx = G.P.x;
        Client.camy = G.P.y;

        enterSpaceMode();

        const sys = G.GALAXY[G.P.sysIdx];
        if (sys) {
          logEvent(`Neural link restored. System entry: ${sys.name} (SEC ${sys.security.toFixed(1)})`, "system");
        }
      },
      // onNewGame
      () => {
        const freshPlayer = makePlayer();
        WorldAccess.initPlayer(freshPlayer);
        savePlayer(); // Initialize the file

        const sysIdx = G.P.sysIdx || 0;
        if (!G.GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
        populateSystem(G.GALAXY[G.P.sysIdx]);

        setupPlayerSpawn();
        validatePlayerFitting();
        computeStats();
        clampPlayerVitals();

        savePlayer(); // Save exact coordinates and initial setup

        Client.camx = G.P.x;
        Client.camy = G.P.y;

        enterSpaceMode();

        const sys = G.GALAXY[G.P.sysIdx];
        if (sys) {
          logEvent(`Neural link initiated. System entry: ${sys.name} (SEC ${sys.security.toFixed(1)})`, "system");
        }
      }
    );

  } catch (err) {
    console.error("FATAL BOOT ERROR:", err);
  }
}

function setupPlayerSpawn() {
  if (G.P.pendingHomeSpawn) {
    PlayerAccess.setPendingHomeSpawn(false);
    const sys = G.GALAXY[G.P.sysIdx];

    // Prefer spawning near the first station in the system
    const st = sys?.stations?.[0];
    if (st) {
      const len = Math.hypot(st.x, st.y) || 1;
      // Default outward direction to (1,0) when station is at origin
      const nx = len > 0.5 ? st.x / len : 1;
      const ny = len > 0.5 ? st.y / len : 0;
      const pad = st.radius + 240;
      PlayerAccess.updatePhysics({ x: st.x + nx * pad, y: st.y + ny * pad });
    } else if (sys?.asteroids?.length) {
      // Fallback: spawn near the first asteroid cluster
      const firstAst = sys.asteroids[0];
      const clusterId = firstAst.id.split("-")[2];
      const cluster = sys.asteroids.filter((a: Asteroid) => a.id.split("-")[2] === clusterId);
      let cx = 0, cy = 0;
      for (const a of cluster) { cx += a.x; cy += a.y; }
      cx /= cluster.length;
      cy /= cluster.length;
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 120 + Math.random() * 80;
      PlayerAccess.updatePhysics({ x: cx + Math.cos(spawnAngle) * spawnDist, y: cy + Math.sin(spawnAngle) * spawnDist });
    } else {
      PlayerAccess.updatePhysics({ x: 0, y: 0 });
    }
    PlayerAccess.updatePhysics({ px: G.P.x, py: G.P.y });
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
      PlayerAccess.addModuleCargo({
        uid: fallbackUid, baseId: C.SPAWNING.FALLBACK_WEAPON.moduleBaseId,
        rarity: ModuleRarity.Stock, itemLevel: C.SPAWNING.FALLBACK_WEAPON.itemLevel,
        durability: C.SPAWNING.FALLBACK_WEAPON.durability, maxDurability: C.SPAWNING.FALLBACK_WEAPON.maxDurability, affixes: [],
      });
      PlayerAccess.setFittingSlot("turret", firstEmpty, fallbackUid);
      validateFitting();
    }
  }
}

function clampPlayerVitals() {
  if (G.P.hp > G.P.maxHp) PlayerAccess.setHp(G.P.maxHp);
  if (G.P.structure > G.P.maxStructure) PlayerAccess.setStructure(G.P.maxStructure);
  if (G.P.structure < 0) PlayerAccess.setStructure(0);
}

boot();
