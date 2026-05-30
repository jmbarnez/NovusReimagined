import { _G, type Player, type TractorState } from "../../state.js";

// ─── Tractor beam accessors ──────────────────────────────────────────────────

export const TractorAccess = {
  /** Update tractor state. */
  update(data: Partial<TractorState>, p: Player = _G.P) {
    if (!p) return;
    if (!p.tractor) {
      p.tractor = {
        active: false,
        targetId: null,
        tooHeavy: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        phase: 0,
      };
    }
    Object.assign(p.tractor, data);
  },
};
