import { _G, type Player, type SalvagerState } from "../../state.js";

// ─── Salvager accessors ──────────────────────────────────────────────────────

export const SalvagerAccess = {
  /** Update salvager state. */
  update(data: Partial<SalvagerState>, p: Player = _G.P) {
    if (!p) return;
    if (!p.salvager) {
      p.salvager = { active: false, targetPieceId: null, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 };
    }
    Object.assign(p.salvager, data);
  },
};
