import { _G as G, Client } from "../src/state.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { buildTutorialCtx } from "../src/data/tutorial.js";
import type { System, Enemy, Station } from "../src/types/world.js";

export function stepById(id: string) {
  const step = TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`missing step ${id}`);
  return step;
}

export function ctxAt(x: number, y: number, snapshot: Record<string, unknown> = {}) {
  G.P.x = x;
  G.P.y = y;
  return buildTutorialCtx(0, 0, snapshot, G.P);
}

export function makeSys(enemies: Enemy[]): System {
  return {
    id: "sys-0",
    idx: 0,
    name: "S.T.A.R.T System",
    mapX: 0,
    mapY: 0,
    ring: 0,
    security: 1,
    links: [],
    stations: [],
    planets: [],
    asteroids: [],
    enemies,
    gates: [],
    nebulaHues: [],
    starHue: 0,
    _ready: true,
  };
}

export function makeStation(): Station {
  return {
    id: "station-tutorial",
    name: "Tutorial Station",
    x: 0,
    y: 0,
    radius: 100,
    spin: 0,
    isHome: true,
    services: ["market", "industry", "repair"],
    safeRadius: 180,
    turrets: [],
  };
}

export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function stepIndex(id: string): number {
  return TUTORIAL_STEPS.findIndex((s) => s.id === id);
}
