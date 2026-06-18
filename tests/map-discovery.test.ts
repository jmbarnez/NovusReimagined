import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { PlayerAccess, WorldAccess } from "../src/state-access.js";
import {
  isSectorDiscovered,
  discoverSector,
  computeDiscoveredMapBounds,
  isLocalRegionDiscovered,
  discoverLocalRegion,
  canSetMapWaypointAt,
  getConcentricSectorAt,
} from "../src/world/map-discovery.js";
import { computeSystemMapTransform } from "../src/ui/map-survey.js";
import { Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import type { System } from "../src/types/system.js";

function stubConcentricSys(idx: number): System {
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

describe("map discovery", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.sysIdx = 1;
    G.P.x = 100;
    G.P.y = 200;
    G.P.discoveredConcentricSectors = [1];
    G.P.discoveredLocalRegionIds = [];
    G.GALAXY = [
      stubConcentricSys(0),
      stubConcentricSys(1),
      stubConcentricSys(2),
      stubConcentricSys(3),
      stubConcentricSys(4),
    ];
  });

  it("discovers sectors idempotently", () => {
    expect(isSectorDiscovered(1, G.P)).toBe(true);
    expect(isSectorDiscovered(2, G.P)).toBe(false);
    discoverSector(2, G.P);
    expect(isSectorDiscovered(2, G.P)).toBe(true);
    discoverSector(2, G.P);
    expect(G.P.discoveredConcentricSectors.filter((i) => i === 2).length).toBe(1);
  });

  it("bounds shrink to discovered sectors only", () => {
    const bounds = computeDiscoveredMapBounds(G.GALAXY[1], 0, 0, G.P);
    expect(bounds.mxX).toBeLessThan(25000);
    expect(bounds.mnX).toBeGreaterThan(-25000);
  });

  it("local region discovery by id", () => {
    discoverLocalRegion("mite-nest", G.P);
    expect(isLocalRegionDiscovered("mite-nest", G.P)).toBe(true);
  });

  it("waypoint allowed only in current concentric sector", () => {
    G.P.sysIdx = 1;
    expect(getConcentricSectorAt(1000, 2500)).toBe(1);
    expect(canSetMapWaypointAt(1000, 2500, G.P)).toBe(true);
    expect(canSetMapWaypointAt(14000, 1500, G.P)).toBe(false);
  });

  it("waypoint always allowed in cadet system", () => {
    G.P.sysIdx = 0;
    G.GALAXY[0] = stubConcentricSys(0);
    expect(canSetMapWaypointAt(99999, 99999, G.P)).toBe(true);
  });
});

describe("map pan transform", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.sysIdx = 1;
    G.P.discoveredConcentricSectors = [1];
    G.GALAXY = [stubConcentricSys(0), stubConcentricSys(1)];
    Client.mapPanX = 500;
    Client.mapPanY = -300;
    Client.mapZoom = 1;
  });

  it("applies pan offset to map center", () => {
    const t = computeSystemMapTransform(1600, 900);
    expect(t).not.toBeNull();
    expect(t!.centerMx).toBe(G.P.x + 500);
    expect(t!.centerMy).toBe(G.P.y - 300);
  });
});
