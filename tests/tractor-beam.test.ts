import { beforeEach, describe, expect, it } from "vitest";
import { Client, _G as G } from "../src/state.js";
import { installTestPlayer } from "../src/player-registry.js";
import { makePlayer } from "../src/player/player-data.js";
import { executeGameCommand } from "../src/sim/commands.js";
import { clearPlayerInput, setPlayerInput, setPlayerInputMouseWorld } from "../src/player/input-state.js";
import { updateTractor } from "../src/player/tractor.js";
import { updateMining } from "../src/physics/mining.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import type { Asteroid } from "../src/types/asteroid.js";

function playerInputId(): string {
  return G.P.netId ?? G.P.shipId;
}

function setupTractorAsteroid(): Asteroid {
  G.P.x = 0;
  G.P.y = 0;
  G.P.px = 0;
  G.P.py = 0;
  G.P.angle = 0;
  G.P.energy = 1000;
  G.P.fitting.high[0] = "start-tu-tractor";
  G.P.fitting.high[1] = "start-tu-civ-miner";
  G.P.fireControlSlot = 0;

  const sys = G.GALAXY[0]!;
  const ast = sys.asteroids[0]!;
  ast.id = "tractor-test-asteroid";
  ast.x = 180;
  ast.y = 0;
  ast.vx = 0;
  ast.vy = 0;
  ast.radius = 12;
  ast.hp = 100;
  ast.maxHp = 100;
  ast.depleted = false;
  setPlayerInputMouseWorld(playerInputId(), { x: ast.x, y: ast.y });
  return ast;
}

describe("tractor beam control", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    clearPlayerInput();
    Client.stationOpen = false;
    Client.showMap = false;
    Client.bridgeOpen = false;
    Client.settingsOpen = false;
  });

  it("does not auto-target nearby objects before the player attaches the beam", () => {
    const ast = setupTractorAsteroid();

    updateTractor(0.1, G.P);

    expect(G.P.tractor?.targetId ?? null).toBeNull();
    expect(G.P.tractor?.active).toBe(false);
    expect(ast.vx ?? 0).toBe(0);
  });

  it("attaches by firing the selected tractor beam at an object", () => {
    const ast = setupTractorAsteroid();

    executeGameCommand({ type: "fireSelectedTurret" }, G.P);
    updateTractor(0.2, G.P);

    expect(G.P.tractor?.targetId).toBe(ast.id);
    expect(G.P.tractor?.sourceSlotIdx).toBe(0);
    expect(G.P.tractor?.active).toBe(true);
    expect(G.P.energy).toBeLessThan(1000);
    expect(ast.vx ?? 0).toBeLessThan(0);
  });

  it("keeps dragging after the player swaps the selected hotbar slot", () => {
    const ast = setupTractorAsteroid();
    executeGameCommand({ type: "fireSelectedTurret" }, G.P);

    G.P.fireControlSlot = 1;
    updateTractor(0.2, G.P);

    expect(G.P.tractor?.targetId).toBe(ast.id);
    expect(G.P.tractor?.active).toBe(true);
    expect(ast.vx ?? 0).toBeLessThan(0);
  });

  it("allows mining the attached object after swapping to the mining slot", () => {
    const ast = setupTractorAsteroid();
    executeGameCommand({ type: "fireSelectedTurret" }, G.P);

    G.P.fireControlSlot = 1;
    setPlayerInput(playerInputId(), {
      space: false,
      w: false,
      a: false,
      s: false,
      d: false,
      boost: false,
      warp: false,
      lmb: true,
    }, { x: ast.x, y: ast.y });
    updateTractor(0.1, G.P);
    updateMining(0.1, G.P);

    expect(G.P.tractor?.targetId).toBe(ast.id);
    expect(G.P.tractor?.active).toBe(true);
    expect(G.P.miningLaser?.active).toBe(true);
  });

  it("retracts the attached beam through the command layer", () => {
    setupTractorAsteroid();
    executeGameCommand({ type: "fireSelectedTurret" }, G.P);

    executeGameCommand({ type: "retractTractorBeam" }, G.P);

    expect(G.P.tractor?.targetId ?? null).toBeNull();
    expect(G.P.tractor?.active).toBe(false);
    expect(G.P.tractorCarryKg ?? 0).toBe(0);
  });
});
