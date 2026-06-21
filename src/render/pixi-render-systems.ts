import { getState } from "../state-access.js";
import { entityLayer, effectLayer, stationLayer } from "../pixi.js";
import { initPixiBackground, refreshBackground, destroyPixiBackground } from "./pixi-background.js";
import { initPixiParticles, destroyPixiParticles } from "./pixi-particles.js";
import { initPixiEntities, destroyPixiEntities } from "./enemy/index.js";
import { initPixiPlayer, destroyPlayerSprites, destroyRemotePlayerSprites, destroyTrailPool } from "./player/index.js";
import { initPixiCombat, destroyPixiCombat } from "./combat/index.js";
import { initPixiEffects, destroyPixiEffects } from "./fx/index.js";
import { initVignette, destroyVignette } from "./pixi-vignette.js";
import { initPixiHUD, destroyPixiHUD } from "./pixi-hud-core.js";
import { initPixiGuideArrows, destroyPixiGuideArrows } from "./pixi-guide-arrows.js";
import { initPixiMaps, destroyPixiMaps } from "./pixi-maps.js";
import { initPixiMinimap, destroyPixiMinimap } from "./pixi-minimap.js";
import { initPixiCelestial, destroyPixiCelestial } from "./celestial/index.js";
import { initPixiAsteroids, destroyPixiAsteroids } from "./pixi-asteroids.js";
import { initPixiHitEffects, destroyPixiHitEffects } from "./pixi-hit-effects.js";
import { destroyLensFlare } from "./pixi-lens-flare.js";
import { destroyEffectsOverlay } from "./pixi-effects-overlay.js";
import { destroyPixiTutorialGates } from "./pixi-tutorial-gates.js";

interface PixiRenderSystem {
  readonly id: string;
  init(): void;
  destroy?(): void;
}

function currentSystem() {
  const player = getState().player;
  return getState().GALAXY?.[player?.sysIdx ?? 0] ?? getState().GALAXY?.[0] ?? null;
}

const RENDER_SYSTEMS: PixiRenderSystem[] = [
  {
    id: "background",
    init: initPixiBackground,
    destroy: destroyPixiBackground,
  },
  {
    id: "vignette",
    init: initVignette,
    destroy: destroyVignette,
  },
  {
    id: "particles",
    init: initPixiParticles,
    destroy: destroyPixiParticles,
  },
  {
    id: "entities",
    init: initPixiEntities,
    destroy: destroyPixiEntities,
  },
  {
    id: "player",
    init: initPixiPlayer,
    destroy: () => {
      destroyPlayerSprites();
      destroyRemotePlayerSprites();
      destroyTrailPool();
    },
  },
  {
    id: "combat",
    init: () => {
      if (entityLayer) initPixiCombat(entityLayer);
    },
    destroy: destroyPixiCombat,
  },
  {
    id: "effects",
    init: () => {
      if (effectLayer) initPixiEffects(effectLayer);
    },
    destroy: destroyPixiEffects,
  },
  {
    id: "asteroids",
    init: () => {
      if (entityLayer) initPixiAsteroids(entityLayer);
    },
    destroy: destroyPixiAsteroids,
  },
  {
    id: "hit-effects",
    init: () => {
      if (effectLayer) initPixiHitEffects(effectLayer);
    },
    destroy: destroyPixiHitEffects,
  },
  {
    id: "celestial",
    init: () => {
      const sys = currentSystem();
      if (stationLayer && sys) initPixiCelestial(stationLayer, sys);
    },
    destroy: destroyPixiCelestial,
  },
  {
    id: "hud",
    init: initPixiHUD,
    destroy: destroyPixiHUD,
  },
  {
    id: "guide-arrows",
    init: initPixiGuideArrows,
    destroy: destroyPixiGuideArrows,
  },
  {
    id: "minimap",
    init: initPixiMinimap,
    destroy: destroyPixiMinimap,
  },
  {
    id: "maps",
    init: initPixiMaps,
    destroy: destroyPixiMaps,
  },
];

function runSystemStep(id: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn(`[render] ${id} lifecycle step failed`, err);
  }
}

export function initFoundationalPixiRenderSystems(): void {
  for (const system of RENDER_SYSTEMS.slice(0, 2)) {
    runSystemStep(system.id, system.init);
  }
}

export function initGameplayPixiRenderSystems(): void {
  for (const system of RENDER_SYSTEMS) {
    runSystemStep(system.id, system.init);
  }
  refreshBackground();
}

export function destroyGameplayPixiRenderSystems(): void {
  for (let i = RENDER_SYSTEMS.length - 1; i >= 0; i--) {
    const system = RENDER_SYSTEMS[i];
    if (system.destroy) runSystemStep(system.id, system.destroy);
  }
  runSystemStep("effects-overlay", destroyEffectsOverlay);
  runSystemStep("lens-flare", destroyLensFlare);
  runSystemStep("tutorial-gates", destroyPixiTutorialGates);
}
