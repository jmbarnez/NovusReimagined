import { describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { queueIndustryJobAction, tickIndustryQueue } from "../src/state/actions.js";

describe("industry server authority helpers", () => {
  it("completes queued craft jobs on the passed player state", () => {
    const p = makePlayer();
    p.ore.iron = 9;

    const queued = queueIndustryJobAction("bar", 1, p);
    expect(queued.success).toBe(true);
    expect(p.craftQueue).toHaveLength(1);

    p.craftQueue[0] = { ...p.craftQueue[0], startTime: Date.now() - 20_000, duration: 1000 };
    tickIndustryQueue(p);

    expect(p.craftQueue).toHaveLength(0);
    expect(p.refined.bar).toBeGreaterThanOrEqual(1);
  });
});
