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

  it("routes processed mixed ore into the chosen tank", () => {
    G.P.mixedOreCargo = [
      { name: "Ferro-nickel Chunk", qty: 2, richness: 2, composition: { iron: 0.7, nickel: 0.3 } },
    ];

    const result = processMixedOreCargo(0, 1, "stable", G.P, "processed-tank-b");
    expect(result.success).toBe(true);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    const tankA = G.P.refineryStorage.find((unit) => unit.id === "processed-tank-a");
    const tankB = G.P.refineryStorage.find((unit) => unit.id === "processed-tank-b");
    expect(tankA?.entries ?? []).toHaveLength(0);
    expect(tankB?.entries ?? []).toHaveLength(1);
    expect(tankB?.entries[0]?.composition.iron).toBeCloseTo(0.7, 2);
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

  it("routes separated stock streams to matching ore bins", () => {
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-bin-route",
      materialId: "processed_stock",
      kind: "processed",
      label: "Mixed stock",
      volumeM3: 3.2,
      massKg: 9_000,
      composition: { iron: 0.62, nickel: 0.24, carbon: 0.14 },
    }, G.P);

    const queued = separateHubMaterial("mat-bin-route", "stable", G.P);
    expect(queued.success).toBe(true);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    expect(G.P.refineryStorage.find((unit) => unit.id === "separated-iron")?.entries.length).toBeGreaterThan(0);
    expect(G.P.refineryStorage.find((unit) => unit.id === "separated-nickel")?.entries.length).toBeGreaterThan(0);
    expect(G.P.refineryStorage.find((unit) => unit.id === "separated-carbon")?.entries.length).toBeGreaterThan(0);
    expect(G.P.refineryStorage.find((unit) => unit.id === "processed-tank-a")?.entries ?? []).toHaveLength(0);
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

  it("does not remove refinery materials when alloying credits are insufficient", () => {
    G.P.credits = 0;
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-no-credit",
      materialId: "processed_stock",
      kind: "processed",
      label: "Ferro stock",
      volumeM3: 2.8,
      massKg: 8_600,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, G.P);

    const queued = alloyHubMaterial("mat-no-credit", "ferro_nickel_stock", "stable", G.P);

    expect(queued.success).toBe(false);
    expect(queued.reason).toContain("Need");
    expect(G.P.hubQueue).toHaveLength(0);
    const materials = flattenStorageMaterials(G.P.refineryStorage);
    expect(materials).toHaveLength(1);
    expect(materials[0]?.id).toBe("mat-no-credit");
  });

  it("routes alloyed stock into the chosen alloy reservoir", () => {
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-alloy-route",
      materialId: "processed_stock",
      kind: "processed",
      label: "Ferro stock",
      volumeM3: 2.8,
      massKg: 8_600,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, G.P);

    const queued = alloyHubMaterial("mat-alloy-route", "ferro_nickel_stock", "stable", G.P, undefined, "alloy-reservoir-b");
    expect(queued.success).toBe(true);

    G.P.hubQueue[0] = { ...G.P.hubQueue[0], startTime: 0, duration: 0 };
    tickHubQueue(G.P);

    const reservoirA = G.P.refineryStorage.find((unit) => unit.id === "alloy-reservoir-a");
    const reservoirB = G.P.refineryStorage.find((unit) => unit.id === "alloy-reservoir-b");
    expect(reservoirA?.entries ?? []).toHaveLength(0);
    expect(reservoirB?.entries ?? []).toHaveLength(1);
    expect(reservoirB?.entries[0]?.kind).toBe("alloy");
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
