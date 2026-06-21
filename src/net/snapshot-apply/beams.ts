import type { WorldSnapshot } from "../../sim/snapshot.js";
import { addBeam, clearBeams } from "../../utils/entities.js";

export function applyBeamSnapshots(snap: WorldSnapshot): void {
  clearBeams();

  for (const ent of snap.entities) {
    if (ent.type === "beam") {
      addBeam({
        x1: ent.x1 ?? ent.x,
        y1: ent.y1 ?? ent.y,
        x2: ent.x2 ?? ent.x + (ent.vx ?? 0),
        y2: ent.y2 ?? ent.y + (ent.vy ?? 0),
        color: ent.color ?? "#ffffff",
        width: ent.width ?? 1,
        life: ent.life ?? 0.5,
      });
    }
  }
}
