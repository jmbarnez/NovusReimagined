import { getState } from "../../../state-access.js";
import { targetByLockId, ensureLockQueue } from "../../../targeting.js";
import type { LockSlot } from "../../../types/combat.js";
import type { ComputedStats } from "../../../player/player-stats.js";
import { hudState } from "../state.js";
import type { LockCard } from "./types.js";
import { createLockCard } from "./create.js";
import { updateLockCard } from "./update-card.js";

export function updateLockRail(st: ComputedStats, now: number) {
  ensureLockQueue();
  const queue = getState().player.lockQueue;
  const primaryId = getState().player.targetLock?.id;

  // Remove cards for targets no longer in queue
  for (const [id, card] of hudState.lockCards) {
    if (!queue.find((s: LockSlot) => s.id === id)) {
      card.el.remove();
      hudState.lockCards.delete(id);
    }
  }

  // Sync/update cards in order
  for (let i = 0; i < queue.length; i++) {
    const slot = queue[i];
    const t = targetByLockId(slot.id);
    if (!t) continue;

    let card = hudState.lockCards.get(slot.id);
    if (!card) {
      card = createLockCard(slot.id);
      hudState.lockCards.set(slot.id, card);
    }

    // Reorder if needed
    if (card.el !== hudState.lockRail!.children[i]) {
      hudState.lockRail!.insertBefore(card.el, hudState.lockRail!.children[i] || null);
    }

    updateLockCard(card, slot, t, st, now, primaryId);
  }

  // Remove trailing empty slots
  while (hudState.lockRail!.children.length > queue.length) {
    hudState.lockRail!.lastChild?.remove();
  }
}
