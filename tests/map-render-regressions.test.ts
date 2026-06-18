import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, _G as G } from "../src/state.js";
import { handleWheel } from "../src/input/mouse.js";
import { computeSystemMapTransform } from "../src/ui/map-survey.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import type { System } from "../src/types/system.js";

vi.mock("../src/ui/hud/zoom-indicator.js", () => ({
  showZoomIndicator: () => {},
}));

async function readSource(relativePath: string): Promise<string> {
  const moduleName = "node:fs";
  const fsModule = await import(moduleName);
  const readFileSyncFn = (fsModule as { readFileSync: (path: URL | string, encoding: string) => string }).readFileSync;
  return readFileSyncFn(new URL(relativePath, import.meta.url), "utf8");
}

function stubSystem(idx: number): System {
  return {
    id: `sys-${idx}`,
    idx,
    name: `Sector ${idx}`,
    mapX: 0,
    mapY: 0,
    security: 0.5,
    ring: 1,
    links: [],
    stations: [],
    gates: [],
    asteroids: [{ id: "a1", x: 500, y: 500, hp: 10, maxHp: 10, radius: 10, depleted: false } as System["asteroids"][0]],
    enemies: [],
    planets: [],
    hiddenSites: [],
    nebulaHues: [],
    starHue: 200,
    ready: true,
  };
}

function setWheelTarget(event: WheelEvent, target: EventTarget | null): void {
  Object.defineProperty(event, "target", { value: target, enumerable: true });
}

function createMapWindow() {
  const mapWindow = document.createElement("div");
  mapWindow.id = "hud-win-map";
  mapWindow.className = "window";
  const mapBody = document.createElement("div");
  mapBody.id = "hud-win-body-map";
  mapWindow.appendChild(mapBody);
  document.body.appendChild(mapWindow);
  const rect = {
    x: 100,
    y: 50,
    left: 100,
    top: 50,
    width: 800,
    height: 600,
    right: 900,
    bottom: 650,
    toJSON: () => ({}),
  } as DOMRect;
  vi.spyOn(mapWindow, "getBoundingClientRect").mockReturnValue(rect);
  return { mapWindow, mapBody };
}

describe("map render regressions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installTestPlayer(makePlayer());
    G.P.sysIdx = 1;
    G.P.discoveredConcentricSectors = [1];
    G.GALAXY = [stubSystem(0), stubSystem(1)];
    Client.gameStarted = true;
    Client.showMap = true;
    Client.mapZoom = 1;
    Client.mapPanX = 0;
    Client.mapPanY = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("zooms toward cursor with pan compensation from map-window wheel events", () => {
    const { mapBody } = createMapWindow();
    const event = new WheelEvent("wheel", { deltaY: -100, clientX: 450, clientY: 350 });
    setWheelTarget(event, mapBody);

    handleWheel(event);

    expect(Client.mapZoom).toBeCloseTo(1.1);
    expect(Client.mapPanX).toBeCloseTo(5);
    expect(Client.mapPanY).toBeCloseTo(0);
  });

  it("ignores wheel zoom from other windows while map is open", () => {
    createMapWindow();
    const cargoWindow = document.createElement("div");
    cargoWindow.className = "window";
    cargoWindow.id = "hud-win-cargo";
    const cargoBody = document.createElement("div");
    cargoBody.id = "hud-win-body-cargo";
    cargoWindow.appendChild(cargoBody);
    document.body.appendChild(cargoWindow);

    const event = new WheelEvent("wheel", { deltaY: -100, clientX: 20, clientY: 30 });
    setWheelTarget(event, cargoBody);

    handleWheel(event);

    expect(Client.mapZoom).toBe(1);
    expect(Client.mapPanX).toBe(0);
    expect(Client.mapPanY).toBe(0);
  });

  it("keeps map transform scale independent from Client.mapZoom", () => {
    const transformAtOne = computeSystemMapTransform(1600, 900);
    expect(transformAtOne).not.toBeNull();

    Client.mapZoom = 2;
    const transformAtTwo = computeSystemMapTransform(1600, 900);
    expect(transformAtTwo).not.toBeNull();

    expect(transformAtTwo!.scale).toBeCloseTo(transformAtOne!.scale);
  });

  it("keeps high-priority map-related UI layers above bridge windows", async () => {
    const turretMenuCss = await readSource("../src/ui/styles/hud-turret-menu.css");
    const xpCss = await readSource("../src/ui/styles/hud-xp.css");
    const bridgeCss = await readSource("../src/ui/styles/bridge.css");

    expect(turretMenuCss).toMatch(/#turret-ctx-menu\s*\{[\s\S]*?z-index:\s*9200;/);
    expect(xpCss).toMatch(/#hud-xp-popup\s*\{[\s\S]*?z-index:\s*9200;/);
    expect(bridgeCss).toMatch(/\.inv-ctx\s*\{[\s\S]*?z-index:\s*9200;/);
  });

  it("keeps map window body transparent for Pixi map visibility and hub tooltip fixed over windows", async () => {
    const mapOverlayCss = await readSource("../src/ui/styles/map-overlay.css");
    const bridgeCss = await readSource("../src/ui/styles/bridge.css");
    const hubTooltipTs = await readSource("../src/ui/hud/hub-tooltip.ts");

    expect(mapOverlayCss).toMatch(/#hud-win-map\s*\{[\s\S]*?background:\s*transparent;/);
    expect(mapOverlayCss).toMatch(/#hud-win-body-map\s*\{[\s\S]*?background:\s*transparent;/);
    expect(bridgeCss).toMatch(/#hud-win-map\s*\{[\s\S]*?background:\s*transparent;/);
    expect(bridgeCss).toMatch(/#hud-win-map \.win-body\s*\{[\s\S]*?background:\s*transparent;/);
    expect(bridgeCss).toMatch(/#hud-win-map \.win-head\s*\{[\s\S]*?background:\s*var\(--hud-bg-deep\);/);
    expect(bridgeCss).toMatch(/#hud-win-map::before\s*\{[\s\S]*?display:\s*none;/);
    expect(hubTooltipTs).toMatch(/position:\s*"fixed"/);
    expect(hubTooltipTs).toMatch(/zIndex:\s*"9200"/);
    expect(hubTooltipTs).toMatch(/append\(document\.body,\s*el\)/);
  });
});
