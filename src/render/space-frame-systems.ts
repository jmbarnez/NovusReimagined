import { Client } from "../state.js";
import type { Player } from "../state.js";
import type { System } from "../types/system.js";
import { renderPixi } from "../pixi.js";
import { updatePixiBackground } from "./pixi-background.js";
import { syncPixiParticles } from "./pixi-particles.js";
import { syncPixiEntities } from "./enemy/index.js";
import { syncPixiPlayer, syncPixiTrails } from "./player/index.js";
import { syncPixiStations } from "./pixi-stations.js";
import { syncPixiPlanets } from "./pixi-planets.js";
import { syncPixiCelestial } from "./celestial/index.js";
import { syncPixiCombat } from "./combat/index.js";
import { syncPixiEffects } from "./fx/index.js";
import { syncPixiAsteroids } from "./pixi-asteroids.js";
import { syncPixiHitEffects } from "./pixi-hit-effects.js";
import { updateVignette } from "./pixi-vignette.js";
import { syncThrust } from "./pixi-thrust.js";
import { syncPixiTutorialMarkers } from "./pixi-tutorial-markers.js";
import { syncPixiRegionBorders } from "./pixi-region-borders.js";
import { syncPixiTutorialTrack } from "./pixi-tutorial-track.js";
import { syncPixiTutorialGates } from "./pixi-tutorial-gates.js";
import { syncPixiStationOverlays } from "./pixi-station-overlays.js";
import { syncPixiLensFlare } from "./pixi-lens-flare.js";
import { syncPixiStationTurrets } from "./pixi-station-turrets.js";
import { syncPixiDamageFlash } from "./pixi-damage-flash.js";
import { syncPixiShockwaves, syncPixiFloatTexts, syncPixiWorldBorder } from "./pixi-effects-overlay.js";
import { syncPixiChatBubbles } from "./pixi-chat-bubbles.js";
import { syncPixiHUD } from "./pixi-hud-core.js";
import { syncPixiTargetArrows, syncPixiTutorialGuideArrow } from "./pixi-target-arrows.js";
import { drawPixiSystemMapCanvasOverlays, syncPixiSystemMap } from "./pixi-maps.js";
import { syncPixiMinimap } from "./pixi-minimap.js";
import { syncPixiCrosshair } from "./pixi-crosshair.js";
import { syncPixiWarpScreen } from "./pixi-warp-screen.js";
import { decayVisualState } from "./entity-visuals.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { SPACE_FRAME_SYSTEM_IDS, type SpaceFrameSystemId } from "./space-frame-system-order.js";

export interface SpaceFrameMapBounds {
  readonly width: number;
  readonly height: number;
}

export interface SpaceFrameSystemContext {
  readonly now: number;
  readonly alpha: number;
  readonly frameDt: number;
  readonly width: number;
  readonly height: number;
  readonly sys: System;
  readonly player: Player | null;
  readonly camxR: number;
  readonly camyR: number;
  readonly tutorialActive: boolean;
  readonly mapBounds: SpaceFrameMapBounds | null;
}

export type SpaceFrameTimingMark = (id: SpaceFrameSystemId) => void;

type SpaceFrameSystemRunner = (ctx: SpaceFrameSystemContext) => void;

const SPACE_FRAME_SYSTEMS: Record<SpaceFrameSystemId, SpaceFrameSystemRunner> = {
  decayVisuals: (ctx) => decayVisualState(ctx.frameDt),
  bg: (ctx) => updatePixiBackground(ctx.now, ctx.camxR, ctx.camyR),
  particles: () => syncPixiParticles(),
  stations: (ctx) => syncPixiStations(ctx.now, ctx.sys),
  entities: (ctx) => syncPixiEntities(ctx.alpha, ctx.now),
  player: (ctx) => syncPixiPlayer(ctx.alpha, ctx.now),
  trails: () => syncPixiTrails(),
  planets: (ctx) => syncPixiPlanets(ctx.now, ctx.sys),
  celestial: (ctx) => syncPixiCelestial(ctx.now, ctx.alpha, ctx.sys),
  combat: (ctx) => syncPixiCombat(ctx.now, ctx.alpha, ctx.sys),
  effects: (ctx) => syncPixiEffects(ctx.now, ctx.alpha, ctx.frameDt, ctx.sys),
  asteroids: (ctx) => syncPixiAsteroids(ctx.now, ctx.alpha, ctx.sys),
  hiteffects: (ctx) => syncPixiHitEffects(ctx.now, ctx.alpha, ctx.sys),
  tutmarkers: (ctx) => {
    if (ctx.tutorialActive) syncPixiTutorialMarkers(ctx.now, ctx.sys);
  },
  borders: (ctx) => syncPixiRegionBorders(ctx.now),
  tuttrack: (ctx) => {
    if (ctx.tutorialActive) syncPixiTutorialTrack(ctx.now);
  },
  tutgates: (ctx) => syncPixiTutorialGates(ctx.now),
  stoverlays: (ctx) => syncPixiStationOverlays(ctx.now, ctx.sys),
  stturrets: (ctx) => syncPixiStationTurrets(ctx.now, ctx.sys),
  lensflare: (ctx) => {
    if (Client.settings?.lensFlare) syncPixiLensFlare(ctx.width, ctx.height);
  },
  dmgflash: (ctx) => syncPixiDamageFlash(ctx.width, ctx.height),
  shockwaves: () => syncPixiShockwaves(),
  floattexts: () => syncPixiFloatTexts(),
  chat: (ctx) => syncPixiChatBubbles(ctx.now),
  worldborder: (ctx) => syncPixiWorldBorder(ctx.now, SECTOR_OUTER_RADIUS),
  crosshair: () => syncPixiCrosshair(),
  map: (ctx) => {
    if (ctx.mapBounds) syncPixiSystemMap(ctx.mapBounds.width, ctx.mapBounds.height, ctx.now);
  },
  thrust: (ctx) => syncThrust(ctx.alpha, ctx.now),
  hud: (ctx) => syncPixiHUD(ctx.width, ctx.height, ctx.now),
  tarrows: (ctx) => syncPixiTargetArrows(ctx.width, ctx.height, ctx.camxR, ctx.camyR, ctx.now),
  guidearrow: (ctx) => {
    if (ctx.tutorialActive) syncPixiTutorialGuideArrow(ctx.width, ctx.height, ctx.camxR, ctx.camyR, ctx.now);
  },
  vignette: () => {
    if (Client.settings?.vignetteEnabled) updateVignette();
  },
  renderPixi: () => renderPixi(),
  mapoverlays: (ctx) => {
    if (ctx.mapBounds) drawPixiSystemMapCanvasOverlays(ctx.mapBounds.width, ctx.mapBounds.height, ctx.now);
  },
  minimap: (ctx) => syncPixiMinimap(ctx.now),
  warpscreen: (ctx) => {
    if (ctx.player && ((ctx.player.warpTargetIdx ?? -1) >= 0 || (ctx.player.warpCooldown ?? 0) > 2.0)) {
      syncPixiWarpScreen(ctx.now);
    }
  },
};

export function runSpaceFrameSystems(
  ctx: SpaceFrameSystemContext,
  mark: SpaceFrameTimingMark,
): void {
  for (const id of SPACE_FRAME_SYSTEM_IDS) {
    SPACE_FRAME_SYSTEMS[id](ctx);
    mark(id);
  }
}
