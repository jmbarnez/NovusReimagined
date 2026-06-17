import { describe, it, expect } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import {
  needsSpawnResolution,
  resolvePlayerSpawn,
  spawnNearFirstStation,
} from "../src/utils/player-spawn.js";
import { TUTORIAL_SPAWN } from "../src/data/tutorial-layout.js";
import type { System } from "../src/types/system.js";

describe("player-spawn", () => {
  it("needsSpawnResolution when pendingHomeSpawn is set", () => {
    const player = makePlayer();
    expect(player.pendingHomeSpawn).toBe(true);
    expect(needsSpawnResolution(player)).toBe(true);
  });

  it("needsSpawnResolution when coordinates are at origin", () => {
    const player = makePlayer();
    player.pendingHomeSpawn = false;
    player.x = 0;
    player.y = 0;
    expect(needsSpawnResolution(player)).toBe(true);
  });

  it("resolvePlayerSpawn places player near station in populated system", () => {
    const galaxy = buildGalaxy();
    populateSystem(galaxy[0]!);

    const player = makePlayer();
    resolvePlayerSpawn(player, galaxy);

    expect(player.pendingHomeSpawn).toBe(false);
    expect(Math.hypot(player.x, player.y)).toBeGreaterThan(100);
    expect(player.px).toBe(player.x);
    expect(player.py).toBe(player.y);
  });

  it("resolvePlayerSpawn uses TUTORIAL_SPAWN fallback when system has no anchors", () => {
    const emptySys: System = {
      id: "empty",
      idx: 99,
      name: "Empty",
      mapX: 0,
      mapY: 0,
      ring: 0,
      security: 1,
      links: [],
      stations: [],
      planets: [],
      asteroids: [],
      enemies: [],
      gates: [],
      nebulaHues: [],
      starHue: 0,
      _ready: false,
    };
    const galaxy = [emptySys];

    const player = makePlayer();
    player.sysIdx = 99;
    player.tutorial.active = false;
    resolvePlayerSpawn(player, galaxy);

    expect(player.x).toBe(TUTORIAL_SPAWN.x);
    expect(player.y).toBe(TUTORIAL_SPAWN.y);
  });

  it("spawnNearFirstStation moves player outward from first station", () => {
    const galaxy = buildGalaxy();
    populateSystem(galaxy[1]!);

    const player = makePlayer();
    player.sysIdx = 1;
    player.x = 0;
    player.y = 0;
    spawnNearFirstStation(player, galaxy, 1);

    const st = galaxy[1]!.stations[0]!;
    expect(Math.hypot(player.x - st.x, player.y - st.y)).toBeGreaterThan(st.radius);
  });
});
