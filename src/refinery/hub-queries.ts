import type { Player } from "../state.js";
import { getState } from "../state-access.js";
import { dst } from "../utils/math.js";
import { curSys } from "../utils/game.js";
import { C } from "../config/index.js";
import type { Station, WreckSalvageEntry } from "../types/world.js";
import type { OreComposition } from "../utils/ore-naming.js";
import { estimateMixedOreCargoMassKg } from "./composition.js";
import { ALLOY_FAMILIES } from "./families.js";
import { getHub } from "./hub-core.js";

export function getDropZoneCenter(hub: Station): { x: number; y: number; radius: number } {
  const dx = hub.dropZoneOffset?.dx ?? 180;
  const dy = hub.dropZoneOffset?.dy ?? 0;
  return {
    x: hub.x + dx,
    y: hub.y + dy,
    radius: hub.dropZoneRadius ?? 140,
  };
}

export function fmtDuration(seconds: number): string {
  const rounded = Math.ceil(seconds);
  if (rounded < 60) return `${rounded}s`;
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function getProcessFee(mass: number): number {
  return Math.max(C.HUB.PROCESS_MIN_FEE, Math.ceil(mass * C.HUB.PROCESS_FEE_PER_MASS));
}

export function getFloatingDeposits(hub: Station, p: Player) {
  const dropZone = getDropZoneCenter(hub);
  const items: Array<{
    id: string;
    kind: "asteroid" | "debris";
    label: string;
    mass: number;
    composition?: OreComposition;
    richness?: number;
    salvagePool?: WreckSalvageEntry[];
  }> = [];

  for (const wp of getState().wreckPieces) {
    if (dst(wp.x, wp.y, dropZone.x, dropZone.y) < dropZone.radius) {
      const mass = wp.radius * wp.radius * 0.8;
      items.push({
        id: wp.id,
        kind: "debris",
        label: wp.name || "Wreck debris",
        mass,
        salvagePool: wp.salvagePool ? [...wp.salvagePool] : [],
      });
    }
  }

  const sys = curSys(p);
  if (sys) {
    for (const ast of sys.asteroids) {
      if (ast.depleted || ast.hp <= 0) continue;
      if (dst(ast.x, ast.y, dropZone.x, dropZone.y) < dropZone.radius) {
        items.push({
          id: ast.id,
          kind: "asteroid",
          label: ast.name || "Asteroid",
          mass: ast.radius * ast.radius * 1.8,
          composition: { ...ast.composition },
          richness: ast.richness,
        });
      }
    }
  }
  return items;
}

export function getCargoMixedOreInputs(p: Player = getState().player) {
  return (p.mixedOreCargo ?? []).map((slot, index) => ({
    id: `mixed-${index}`,
    index,
    label: slot.name,
    qty: slot.qty,
    richness: slot.richness ?? 1,
    composition: { ...slot.composition },
    massKg: estimateMixedOreCargoMassKg(slot.qty, slot.composition),
  }));
}

export function getAlloyFamilies() {
  return ALLOY_FAMILIES;
}
