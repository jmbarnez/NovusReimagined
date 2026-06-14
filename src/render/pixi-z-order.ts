import type { Container } from "pixi.js";

export const STAGE_LAYER_Z = {
  SCREEN: 0,
  WORLD: 100,
  FLOAT_TEXT: 150,
  HUD: 200,
  MAP: 300,
  VIGNETTE: 1000,
} as const;

export const WORLD_LAYER_Z = {
  PLANETS: 0,
  STATIONS: 100,
  THRUST: 200,
  ENTITIES: 300,
  EFFECTS: 400,
} as const;

export const SCREEN_LAYER_Z = {
  NEBULA: 0,
  FAR_STARS: 100,
  MID_STARS: 200,
  NEAR_STARS: 300,
  DUST: 400,
  STATION_INTERIOR: 700,
  WARP_SCREEN: 900,
} as const;

export const MAP_LAYER_Z = {
  BACKGROUND: 0,
  GRID: 100,
  SECTORS: 200,
  STAR: 300,
  OBJECTS: 400,
  WAYPOINT: 500,
  PLAYER: 600,
  VIGNETTE: 700,
  LABELS: 800,
  OVERLAYS: 900,
} as const;

export const HUD_LAYER_Z = {
  CORE: 0,
  TARGET_ARROWS: 100,
} as const;

export const EFFECT_LAYER_Z = {
  OVERLAY: 500,
} as const;

export const FLOAT_LAYER_Z = {
  CARDS: 0,
  TEXT: 100,
} as const;

export function configureStageLayerOrder(
  stage: Container,
  screen: Container,
  world: Container,
  hud: Container,
): void {
  stage.sortableChildren = true;
  screen.sortableChildren = true;
  world.sortableChildren = true;
  hud.sortableChildren = true;
  screen.zIndex = STAGE_LAYER_Z.SCREEN;
  world.zIndex = STAGE_LAYER_Z.WORLD;
  hud.zIndex = STAGE_LAYER_Z.HUD;
}

export function configureWorldLayerOrder(
  planet: Container,
  station: Container,
  thrust: Container,
  entity: Container,
  effect: Container,
): void {
  planet.sortableChildren = true;
  station.sortableChildren = true;
  thrust.sortableChildren = true;
  entity.sortableChildren = true;
  effect.sortableChildren = true;
  planet.zIndex = WORLD_LAYER_Z.PLANETS;
  station.zIndex = WORLD_LAYER_Z.STATIONS;
  thrust.zIndex = WORLD_LAYER_Z.THRUST;
  entity.zIndex = WORLD_LAYER_Z.ENTITIES;
  effect.zIndex = WORLD_LAYER_Z.EFFECTS;
}

export function configureMapLayerOrder(
  positioning: Container,
  map: Container,
): void {
  positioning.sortableChildren = true;
  map.sortableChildren = true;
  positioning.zIndex = STAGE_LAYER_Z.MAP;
}
