import { describe, expect, it, vi } from "vitest";
import { Container } from "pixi.js";
import { STAGE_LAYER_Z, WORLD_LAYER_Z, MAP_LAYER_Z } from "../src/render/pixi-z-order.js";

const stage = new Container();
const screen = new Container();
const world = new Container();
const hud = new Container();

vi.mock("../src/pixi.js", () => ({
  app: { stage, renderer: {} },
  screenContainer: screen,
  worldContainer: world,
  hudOverlayLayer: hud,
  effectLayer: new Container(),
  entityLayer: new Container(),
  stationLayer: new Container(),
  thrustLayer: new Container(),
  planetLayer: new Container(),
  pixiDpr: 1,
}));

describe("pixi z-ordering", () => {
  it("sets stable stage and world z-indices", async () => {
    const mod = await import("../src/pixi.js");
    expect(mod.app).not.toBeNull();

    const st = mod.app!.stage as Container;
    const sc = mod.screenContainer as Container;
    const wo = mod.worldContainer as Container;
    const hd = mod.hudOverlayLayer as Container;

    // emulate the same structure as initPixi to validate ordering contract
    st.removeChildren();
    st.addChild(sc);
    st.addChild(wo);
    st.addChild(hd);

    const { configureStageLayerOrder, configureWorldLayerOrder, configureMapLayerOrder } = await import("../src/render/pixi-z-order.js");
    configureStageLayerOrder(st, sc, wo, hd);

    const planet = new Container();
    const station = new Container();
    const thrust = new Container();
    const entity = new Container();
    const effect = new Container();
    wo.addChild(planet, station, thrust, entity, effect);
    configureWorldLayerOrder(planet, station, thrust, entity, effect);

    expect(st.sortableChildren).toBe(true);
    expect(sc.zIndex).toBe(STAGE_LAYER_Z.SCREEN);
    expect(wo.zIndex).toBe(STAGE_LAYER_Z.WORLD);
    expect(hd.zIndex).toBe(STAGE_LAYER_Z.HUD);
    expect(planet.zIndex).toBe(WORLD_LAYER_Z.PLANETS);
    expect(effect.zIndex).toBe(WORLD_LAYER_Z.EFFECTS);

    const mapPositioning = new Container();
    const mapContent = new Container();
    mapPositioning.addChild(mapContent);
    configureMapLayerOrder(mapPositioning, mapContent);
    expect(mapPositioning.zIndex).toBe(STAGE_LAYER_Z.MAP);

    const mapBg = new Container();
    const mapOverlay = new Container();
    mapBg.zIndex = MAP_LAYER_Z.BACKGROUND;
    mapOverlay.zIndex = MAP_LAYER_Z.OVERLAYS;
    mapContent.sortableChildren = true;
    mapContent.addChild(mapOverlay);
    mapContent.addChild(mapBg);
    expect(mapBg.zIndex).toBeLessThan(mapOverlay.zIndex);
  });
});
