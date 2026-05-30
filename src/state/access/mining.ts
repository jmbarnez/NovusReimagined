import { _G, type Player, type MiningLaserState } from "../../state.js";

// ─── Mining laser accessors ──────────────────────────────────────────────────

export const MiningAccess = {
  /** Update mining laser state. */
  update(data: Partial<MiningLaserState>, p: Player = _G.P) {
    if (!p) return;
    if (!p.miningLaser) {
      p.miningLaser = {
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        phase: 0,
        hitR: 0,
        hitNx: 0,
        hitNy: 0,
        oreKey: "",
        oreColor: "",
      };
    }
    Object.assign(p.miningLaser, data);
  },
};
