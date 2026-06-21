import { afterEach, describe, expect, it, vi } from "vitest";
import { generateModuleInstance, isPlayerWeaponModule, playerWeaponModuleIds } from "../src/loot/generateModule.js";
import { playerWeaponSalvagePool, rollWreckSalvage } from "../src/wreck/salvage.js";
import { MODULES, MODULE_FLAGS } from "../src/data/modules.js";

describe("weapon-first loot generation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("identifies only player-usable combat weapons as weapon loot", () => {
    expect(isPlayerWeaponModule("tu-cannon")).toBe(true);
    expect(isPlayerWeaponModule("tu-pulse")).toBe(true);
    expect(isPlayerWeaponModule("tu-npc-mite-laser")).toBe(false);
    expect(isPlayerWeaponModule("tu-civilian-miner")).toBe(false);
    expect(isPlayerWeaponModule("me-ab1")).toBe(false);
  });

  it("falls back to a player weapon pool when enemy pools contain utility or npc-only modules", () => {
    const pool = playerWeaponSalvagePool([
      { id: "tu-npc-mite-laser", weight: 10 },
      { id: "me-ab1", weight: 10 },
    ]);

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((entry) => isPlayerWeaponModule(entry.id))).toBe(true);
  });

  it("generates valid rolled player weapon instances from salvage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const drops = rollWreckSalvage([
      { id: "tu-npc-sentry-cannon", weight: 10 },
      { id: "tu-cannon", weight: 1 },
    ], 1, 6);
    const moduleDrop = drops.find((drop) => drop.kind === "module");

    expect(moduleDrop?.payload).toBe("tu-cannon");
    expect(moduleDrop?.instance?.baseId).toBe("tu-cannon");
    expect(moduleDrop?.instance?.itemLevel).toBe(6);
    expect(moduleDrop?.instance?.durability).toBeGreaterThan(0);
    expect(moduleDrop?.instance?.affixes.every((affix) => affix.affectedStat.startsWith("weapon"))).toBe(true);
  });

  it("generated player weapon ids are real weapon modules and exclude npc-only weapons", () => {
    const ids = playerWeaponModuleIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const module = MODULES[id];
      expect(module).toBeTruthy();
      expect(MODULE_FLAGS.isWeapon(module)).toBe(true);
      expect(id.startsWith("tu-npc-")).toBe(false);
    }
  });

  it("weapon generator restricts rolled affixes to weapon profile stats", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const inst = generateModuleInstance("tu-cannon", 10, 8);

    expect(inst.baseId).toBe("tu-cannon");
    expect(inst.affixes.length).toBeGreaterThan(0);
    expect(inst.affixes.every((affix) => affix.affectedStat.startsWith("weapon"))).toBe(true);
  });
});
