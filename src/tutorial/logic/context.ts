import { getState } from "../../state-access.js";
import { dst } from "../../utils/math.js";
import { getSnapshot, patchSnapshot } from "./snapshot.js";
import type { TutorialCtx, TutorialZone } from "../types.js";

export function nowSec(): number {
  return Date.now() / 1000;
}

// Reuse a single TutorialCtx object to avoid allocations in the frame loop.
let _ctx: TutorialCtx | null = null;

export function buildCtx(): TutorialCtx {
  const now = nowSec();
  const p = getState().player;
  const stepEnteredAt = p.tutorial.stepEnteredAt ?? now;
  if (!_ctx) {
    _ctx = {
      player: p,
      now,
      stepEnteredAt,
      snapshot: getSnapshot(),
      patchSnapshot,
      setSnapshotField(key, value) {
        patchSnapshot({ [key]: value });
      },
      distToZone(zone: TutorialZone) {
        return dst(this.player.x, this.player.y, zone.x, zone.y);
      },
      inZone(zone: TutorialZone) {
        return dst(this.player.x, this.player.y, zone.x, zone.y) < zone.r;
      },
    };
    return _ctx;
  }
  _ctx.player = p;
  _ctx.now = now;
  _ctx.stepEnteredAt = stepEnteredAt;
  _ctx.snapshot = getSnapshot();
  _ctx.patchSnapshot = patchSnapshot;
  _ctx.setSnapshotField = (key, value) => patchSnapshot({ [key]: value });
  return _ctx;
}
