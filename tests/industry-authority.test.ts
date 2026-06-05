import { describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { queueIndustryJobAction, tickIndustryQueue } from "../src/state/actions.js";
import { PlayerAccess } from "../src/state-access.js";

describe("industry server authority helpers", () => {
  it("completes queued craft jobs on the passed player state", () => {
    const p = makePlayer();
    PlayerAccess.addBulkMaterial({
      id: "bulk-1",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9_780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, p);
    p.loot.scrap = 4;

    const queued = queueIndustryJobAction("gear", 1, p);
    expect(queued.success).toBe(true);
    expect(p.craftQueue).toHaveLength(1);

    p.craftQueue[0] = { ...p.craftQueue[0], startTime: Date.now() - 20_000, duration: 1000 };
    tickIndustryQueue(p);

    expect(p.craftQueue).toHaveLength(0);
    expect(p.components.gear).toBeGreaterThanOrEqual(1);
  });

  it("consumes alloy material volume for fabrication recipes", () => {
    const p = makePlayer();
    PlayerAccess.addBulkMaterial({
      id: "bulk-1",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9_780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, p);
    p.loot.scrap = 4;

    const queued = queueIndustryJobAction("gear", 1, p);
    expect(queued.success).toBe(true);
    expect(p.craftQueue).toHaveLength(1);
    expect((p.bulkMaterialsCargo[0]?.volumeM3 ?? 0)).toBeCloseTo(0.6, 3);

    p.craftQueue[0] = { ...p.craftQueue[0], startTime: Date.now() - 20_000, duration: 1000 };
    tickIndustryQueue(p);

    expect(p.craftQueue).toHaveLength(0);
    expect(p.components.gear).toBeGreaterThanOrEqual(1);
  });
});
