import type { SalvagePickup } from "../types/system.js";
import { getState, PlayerAccess } from "../state-access.js";
import { dst } from "../utils/math.js";
import { showPickupToast } from "../feedback.js";
import { ORE } from "../data/resources.js";
import { progressMissions } from "../data/missions.js";
import { generateModuleInstance } from "../loot/generateModule.js";
import { invalidateInstanceCache } from "../utils/items.js";
import { generateOreName, normalizeComposition, oreColorForComposition } from "../utils/ore-naming.js";
import { addParticle, removeSalvagePickup, tickAndCull } from "../utils/entities.js";
import { SALVAGE_PICKUP_DRAG } from "../constants.js";
import { C } from "../config/index.js";
import { updateWreckPieces } from "./pieces.js";

const PICKUP_RANGE = C.ECONOMY.WRECK.pickupRange;

function collectSalvagePickup(s: SalvagePickup) {
  if (s.kind === "ore") {
    if (s.composition) {
      const composition = normalizeComposition(s.composition);
      const name = s.name ?? generateOreName(composition);
      PlayerAccess.addMixedOreCargo({ composition, qty: s.qty, name, richness: s.richness });
      for (const [oreKey, fraction] of Object.entries(composition)) {
        const creditedQty = Math.max(1, Math.floor(s.qty * fraction));
        progressMissions("mining", creditedQty, oreKey);
      }
      showPickupToast("ore", s.payload, s.qty, undefined, name);
    } else {
      PlayerAccess.setOre(s.payload, (getState().player.ore[s.payload] || 0) + s.qty);
      progressMissions("mining", s.qty, s.payload);
      showPickupToast("ore", s.payload, s.qty);
    }
  } else if (s.kind === "loot") {
    PlayerAccess.setLoot(s.payload, (getState().player.loot[s.payload] || 0) + s.qty);
    progressMissions("salvage", s.qty, s.payload);
    showPickupToast("loot", s.payload, s.qty);
  } else if (s.kind === "credits") {
    PlayerAccess.modifyCredits(s.qty);
    showPickupToast("credits", "", s.qty);
  } else {
    try {
      const inst = s.instance || generateModuleInstance(s.payload, 1, 1);
      PlayerAccess.addModuleCargo(inst);
      invalidateInstanceCache();
      showPickupToast("module", s.payload, 1, inst);
    } catch {
      PlayerAccess.setLoot("scrap", (getState().player.loot.scrap || 0) + 1);
      showPickupToast("loot", "scrap", 1);
    }
  }
}

export function updateSalvagePickups(dt: number) {
  const drag = Math.pow(SALVAGE_PICKUP_DRAG, dt);
  tickAndCull(getState().salvagePickups, dt, (s) => {
    s.life -= dt;
    s.bob += dt * C.ECONOMY.SALVAGE_PICKUP.bobRate;

    const dx = getState().player.x - s.x;
    const dy = getState().player.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 200 && dist > 0.01) {
      const forcePct = 1 - dist / 200;
      const pullForce = 520 * forcePct * forcePct + 80;
      s.vx += (dx / dist) * pullForce * dt;
      s.vy += (dy / dist) * pullForce * dt;

      if (Math.random() < 0.16) {
        let sparkColor = "#ffe066";
        if (s.kind === "loot") sparkColor = "#aaffaa";
        else if (s.kind === "module") sparkColor = "#00e8c8";
        else if (s.kind === "ore") {
          sparkColor = s.composition ? oreColorForComposition(s.composition) : (ORE[s.payload] ?? ORE.iron).color;
        }

        addParticle({
          x: s.x,
          y: s.y,
          vx: -s.vx * 0.35 + (Math.random() - 0.5) * 15,
          vy: -s.vy * 0.35 + (Math.random() - 0.5) * 15,
          r: 0.9 + Math.random() * 0.8,
          life: 0.22 + Math.random() * 0.16,
          drag: 0.93,
          decay: 2.8,
          color: sparkColor,
        });
      }
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= drag;
    s.vy *= drag;

    if (s.life <= 0) return true;
    if (dst(getState().player.x, getState().player.y, s.x, s.y) < PICKUP_RANGE) {
      collectSalvagePickup(s);
      return true;
    }
  }, removeSalvagePickup);
}

export function updateWreckPiecesAndPickups(dt: number) {
  updateWreckPieces(dt);
  updateSalvagePickups(dt);
}
