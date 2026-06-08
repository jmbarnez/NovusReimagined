import { getState } from "../state-access.js";
import { queueFrameAction } from "../sim/input.js";
import { buildTutorialCtx } from "../data/tutorial.js";

export let snapshot: Record<string, unknown> = {};
export let tutorialEventsBound = false;

export function setSnapshot(next: Record<string, unknown>): void {
  snapshot = next;
}

export function setTutorialEventsBound(next: boolean): void {
  tutorialEventsBound = next;
}

export function nowSec(): number {
  return Date.now() / 1000;
}

export function buildCtx() {
  return buildTutorialCtx(nowSec(), getState().player.tutorial.stepEnteredAt ?? nowSec(), snapshot, getState().player);
}

export function syncTutorialStateToServer() {
  queueFrameAction({
    type: "syncTutorialStep",
    payload: { ...getState().player.tutorial },
  });
}
