import { describe, it, expect, beforeEach, vi } from "vitest";
import { Client, AppMode } from "../src/state.js";
import { createLocalInputFrame } from "../src/sim/input.js";
import { handleMouseDown, handleMouseUp, handleMouseMove, handleContextMenu, handleWindowBlur } from "../src/input/mouse.js";
import { handleKeyDown, handleKeyUp } from "../src/input/bindings.js";
import { initSettings } from "../src/ui/settings/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { initGameSession } from "../src/utils/restore-save.js";
import { WorldAccess, getState } from "../src/state-access.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { SpatialGrid } from "../src/utils/spatial.js";
import { C } from "../src/config/index.js";
import * as proceduralAudio from "../src/audio/procedural.js";

describe("new game client input", () => {
  beforeEach(() => {
    // Reset client state
    Client.keys = {};
    Client.mouse = { x: 0, y: 0, lmb: false, rmb: false };
    Client.mouseWorld = { x: 0, y: 0 };
    Client.gameStarted = false;
    Client.stationOpen = false;
    Client.bridgeOpen = false;
    Client.showMap = false;
    Client.settingsOpen = false;
    Client.cursorUnlocked = false;
    Client.mode = AppMode.SPACE;

    // Initialize settings (default direct mode)
    initSettings();

    // Set up galaxy
    WorldAccess.setGalaxy(buildGalaxy());
    for (const sys of getState().GALAXY) {
      populateSystem(sys);
    }
    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));

    // Create and init player
    const freshPlayer = makePlayer();
    initGameSession(freshPlayer, { setupSpawn: true });

    // Simulate game started
    Client.gameStarted = true;

    // Set mouse world position (simulating drawFrame update)
    Client.mouseWorld = { x: 500, y: 0 };
  });

  it("fires weapon on left-click", () => {
    const event = new MouseEvent("mousedown", { button: 0, clientX: 400, clientY: 300 });
    handleMouseDown(event);

    const frame = createLocalInputFrame(1);

    expect(frame.actions.some(a => a.type === "fireSelectedTurret")).toBe(true);
    expect(Client.mouse.lmb).toBe(true);
  });

  it("does not set waypoint on right-click (waypoint mode removed)", () => {
    const event = new MouseEvent("mousedown", { button: 2, clientX: 400, clientY: 300 });
    handleMouseDown(event);

    // Right-click no longer sets waypoint; mouse.rmb not tracked for empty space clicks
    expect(Client.mouse.rmb).toBe(false);
  });

  it("always sends WASD keys", () => {
    Client.keys["w"] = true;
    Client.keys["a"] = true;

    const frame = createLocalInputFrame(1);

    expect(frame.keys.w).toBe(true);
    expect(frame.keys.a).toBe(true);
    expect(frame.keys.s).toBe(false);
    expect(frame.keys.d).toBe(false);
  });

  it("stops engine nodes and clears held movement input on window blur", () => {
    Client.keys["w"] = true;
    Client.keys["boost"] = true;
    Client.mouse.lmb = true;
    const stopEngineNodesSpy = vi.spyOn(proceduralAudio, "stopEngineNodes").mockImplementation(() => {});
    handleWindowBlur();
    expect(stopEngineNodesSpy).toHaveBeenCalledTimes(1);
    expect(Client.keys["w"]).toBe(false);
    expect(Client.keys["boost"]).toBe(false);
    expect(Client.mouse.lmb).toBe(false);
    stopEngineNodesSpy.mockRestore();
  });
});
