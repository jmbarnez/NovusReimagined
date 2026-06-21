import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { updateViewportBounds } from "../src/utils/game.js";

vi.mock("../src/pixi.js", () => ({
  entityLayer: new Container(),
  effectLayer: new Container(),
  pixiDpr: 1,
}));

describe("syncPixiEntities", () => {
  beforeEach(async () => {
    globalThis.CanvasRenderingContext2D = globalThis.CanvasRenderingContext2D
      ?? (function CanvasRenderingContext2D() {} as unknown as typeof CanvasRenderingContext2D);
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.sysIdx = 0;
    G.P.x = 0;
    G.P.y = 0;
    updateViewportBounds(1280, 720, 1, 0, 0);

    const pixiMod = await import("../src/pixi.js");
    pixiMod.entityLayer!.removeChildren();
    pixiMod.effectLayer!.removeChildren();

    const entitiesMod = await import("../src/render/pixi-entities.js");
    entitiesMod.clearEnemyTextureCaches();
  });

  it("hides offscreen enemy bundles and restores them when visible again", async () => {
    const pixiMod = await import("../src/pixi.js");
    const entitiesMod = await import("../src/render/pixi-entities.js");
    const enemy = G.GALAXY[0]!.liveEnemies?.[0] ?? G.GALAXY[0]!.enemies[0]!;

    enemy.x = 4000;
    enemy.y = 4000;
    enemy.px = enemy.x;
    enemy.py = enemy.y;
    G.GALAXY[0]!.liveEnemies = [enemy];

    entitiesMod.syncPixiEntities(1, 0);

    expect(pixiMod.entityLayer!.children.length).toBeGreaterThanOrEqual(2);
    expect(
      pixiMod.entityLayer!.children.every((child) => child.visible === false || child.alpha === 0),
    ).toBe(true);
    expect(
      pixiMod.effectLayer!.children.every((child) => child.visible === false || child.alpha === 0),
    ).toBe(true);

    enemy.x = 0;
    enemy.y = 0;
    enemy.px = 0;
    enemy.py = 0;

    entitiesMod.syncPixiEntities(1, 0);

    expect(
      pixiMod.entityLayer!.children.some((child) => child.visible !== false && child.alpha > 0),
    ).toBe(true);
  });
});
