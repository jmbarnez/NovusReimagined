import { beforeEach, describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { _G as G } from "../src/state.js";
import { PlayerAccess } from "../src/state-access.js";
import { alloyHubMaterial, collectHubOutput, processMixedOreCargo, separateHubMaterial, tickHubQueue } from "../src/hub.js";
import { flattenStorageMaterials } from "../src/refining.js";

describe("hub refining pipeline", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.credits = 50_000;
  });

  it("processes mixed cargo into composition-preserving stock", () => {
    G.P.mixedOreCargo = [
      { name: "Ferro-nickel Chunk", qty: 6, richness: 2.4, composition: { iron: 0.7, nickel: 0.3 } },
    ];

    const result = processMixedOreCargo(0, 4, "stable", G.P);
    expect(result.success).toBe(true);
    expect(G.P.hubQueue).toHaveLength(1);
    expect(G.P.mixedOreCargo[0]?.qty).toBe(2);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    expect(G.P.hubQueue).toHaveLength(0);
    const materials = flattenStorageMaterials(G.P.refineryStorage);
    expect(materials).toHaveLength(1);
    expect(materials[0]?.kind).toBe("processed");
    expect(materials[0]?.composition.iron).toBeCloseTo(0.7, 2);
    expect(materials[0]?.composition.nickel).toBeCloseTo(0.3, 2);
  });

  it("separates processed stock into simpler streams", () => {
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-seed",
      materialId: "processed_stock",
      kind: "processed",
      label: "Mixed stock",
      volumeM3: 3.2,
      massKg: 9_000,
      composition: { iron: 0.62, nickel: 0.24, carbon: 0.14 },
    }, G.P);

    const queued = separateHubMaterial("mat-seed", "stable", G.P);
    expect(queued.success).toBe(true);
    expect(flattenStorageMaterials(G.P.refineryStorage)).toHaveLength(0);
    expect(G.P.hubQueue).toHaveLength(1);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    const materials = flattenStorageMaterials(G.P.refineryStorage);
    expect(materials.length).toBeGreaterThan(1);
    expect(materials.every((entry) => entry.kind === "processed")).toBe(true);
  });

  it("alloys stock and transfers the result into cargo mass-aware storage", () => {
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-ferro",
      materialId: "processed_stock",
      kind: "processed",
      label: "Ferro stock",
      volumeM3: 2.8,
      massKg: 8_600,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, G.P);

    const queued = alloyHubMaterial("mat-ferro", "ferro_nickel_stock", "stable", G.P);
    expect(queued.success).toBe(true);
    expect(G.P.hubQueue).toHaveLength(1);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    const materials = flattenStorageMaterials(G.P.refineryStorage);
    expect(materials).toHaveLength(1);
    expect(materials[0]?.kind).toBe("alloy");
    expect(materials[0]?.alloyFamilyId).toBe("ferro_nickel_stock");

    const collected = collectHubOutput(G.P);
    expect(collected.materials).toHaveLength(1);
    expect(G.P.bulkMaterialsCargo).toHaveLength(1);
    expect(G.P.bulkMaterialsCargo[0]?.massKg).toBeGreaterThan(0);
  });

  it("registers discovered in-between alloys in the player codex", () => {
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-discovery-a",
      materialId: "processed_stock",
      kind: "processed",
      label: "Irregular discovery stock",
      volumeM3: 1.3,
      massKg: 4_200,
      composition: { iron: 0.34, nickel: 0.17, crystal: 0.21, exotic: 0.18, silicate: 0.1 },
    }, G.P);

    const queued = alloyHubMaterial("mat-discovery-a", "ferro_nickel_stock", "stable", G.P);
    expect(queued.success).toBe(true);
    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    expect(G.P.alloyCodex.discoveries.length).toBe(1);
    const stored = flattenStorageMaterials(G.P.refineryStorage);
    expect(stored[0]?.alloyFamilyId).toBe(G.P.alloyCodex.discoveries[0]?.id);
  });
});
