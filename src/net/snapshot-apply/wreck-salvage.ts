import type { Player } from "../../state.js";
import { getState } from "../../state-access.js";
import { addWreckPiece, addSalvagePickup } from "../../utils/entities.js";
import { showPickupToast } from "../../feedback.js";
import { sfxItemPickup, sfxCreditPickup } from "../../audio/procedural.js";
import type { SnapshotEntityMaps } from "./entity-maps.js";
import { toSalvageKind } from "./converters.js";

export function applyWreckSnapshots(maps: SnapshotEntityMaps): void {
  for (let i = getState().wreckPieces.length - 1; i >= 0; i--) {
    const wp = getState().wreckPieces[i];
    const snapEnt = maps.wrecks.get(wp.id);
    if (snapEnt) {
      wp.x = snapEnt.x;
      wp.y = snapEnt.y;
      wp.vx = snapEnt.vx;
      wp.vy = snapEnt.vy;
      wp.angle = snapEnt.angle || 0;
      wp.hp = snapEnt.hp || 10;
      wp.maxHp = snapEnt.maxHp || 10;
      maps.wrecks.delete(wp.id);
    } else {
      getState().wreckPieces.splice(i, 1);
    }
  }

  for (const ent of maps.wrecks.values()) {
    addWreckPiece({
      id: String(ent.id),
      x: ent.x,
      y: ent.y,
      vx: ent.vx,
      vy: ent.vy,
      angle: ent.angle || 0,
      angularVel: ent.spinVel || 0,
      pts: ent.pts || [],
      radius: ent.radius || 15,
      type: "wreck",
      name: ent.name || "Debris",
      hp: ent.hp || 10,
      maxHp: ent.maxHp || 10,
      age: ent.age || 0,
      despawnTimer: ent.despawnTimer || 10,
      salvagePool: [],
      bob: 0,
      hitFlash: 0,
    });
  }
}

export function applySalvageSnapshots(maps: SnapshotEntityMaps, p: Player | null): void {
  for (let i = getState().salvagePickups.length - 1; i >= 0; i--) {
    const sp = getState().salvagePickups[i];
    const snapEnt = maps.salvages.get(sp.id);
    if (snapEnt) {
      sp.x = snapEnt.x;
      sp.y = snapEnt.y;
      sp.vx = snapEnt.vx;
      sp.vy = snapEnt.vy;
      sp.qty = snapEnt.qty || 1;
      sp.composition = snapEnt.composition ? { ...snapEnt.composition } : undefined;
      sp.name = snapEnt.name;
      sp.richness = snapEnt.richness;
      maps.salvages.delete(sp.id);
    } else {
      if (p && Math.hypot(sp.x - p.x, sp.y - p.y) <= 72) {
        showPickupToast(sp.kind, sp.payload, Math.max(1, sp.qty || 1), sp.instance, sp.name);
        if (sp.kind === "credits") {
          sfxCreditPickup();
        } else if (sp.kind === "ore" || sp.kind === "loot" || sp.kind === "module") {
          sfxItemPickup(sp.kind, sp.x, sp.y);
        }
      }
      getState().salvagePickups.splice(i, 1);
    }
  }

  for (const ent of maps.salvages.values()) {
    addSalvagePickup({
      id: String(ent.id),
      x: ent.x,
      y: ent.y,
      vx: ent.vx,
      vy: ent.vy,
      life: 10,
      bob: 0,
      kind: toSalvageKind(ent.kind),
      payload: ent.payload || "scrap",
      qty: ent.qty || 1,
      composition: ent.composition ? { ...ent.composition } : undefined,
      name: ent.name,
      richness: ent.richness,
    });
  }
}
