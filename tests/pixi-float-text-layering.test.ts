import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { _G as G } from "../src/state.js";
import { installTestPlayer } from "../src/player-registry.js";
import { makePlayer } from "../src/player/player-data.js";
import { updateViewportBounds } from "../src/utils/game.js";

const stage = new Container();
const worldLayer = new Container();
const effectLayer = new Container();

vi.mock("../src/pixi.js", () => ({
  app: { stage, renderer: {} },
  worldContainer: worldLayer,
  effectLayer,
  screenContainer: null,
  pixiDpr: 1,
}));

describe("pixi float-text layering regression", () => {
  beforeEach(() => {
    stage.removeChildren();
    worldLayer.removeChildren();
    effectLayer.removeChildren();
    stage.sortableChildren = true;
    stage.addChild(worldLayer);
    stage.addChild(effectLayer);

    G.floatTexts = [];
    installTestPlayer(makePlayer());
    G.P.x = 0;
    G.P.y = 0;
    G.P.px = 0;
    G.P.py = 0;
    updateViewportBounds(1280, 720, 1, 0, 0);
  });

  it("keeps float-text layer above world and below map overlay after sync", async () => {
    const overlay = await import("../src/render/pixi-effects-overlay.js");
    const { STAGE_LAYER_Z } = await import("../src/render/pixi-z-order.js");
    G.floatTexts.push({
      id: 1,
      x: 0,
      y: 0,
      text: "-12",
      color: "#ffffff",
      life: 1,
      vy: -44,
    });

    // Simulate a map overlay attached later to stage
    const mapOverlay = new Container();
    mapOverlay.label = "map-positioning";
    mapOverlay.zIndex = STAGE_LAYER_Z.MAP;
    stage.addChild(mapOverlay);

    overlay.syncPixiFloatTexts();

    const floatLayer = stage.children.find((c) => c.label === "float-text-overlay") as Container | undefined;
    expect(floatLayer).toBeTruthy();
    expect(floatLayer?.zIndex).toBe(STAGE_LAYER_Z.FLOAT_TEXT);
    expect(floatLayer?.zIndex).toBeGreaterThan(STAGE_LAYER_Z.WORLD);
    expect(floatLayer?.zIndex).toBeLessThan(mapOverlay.zIndex);
  });
});
