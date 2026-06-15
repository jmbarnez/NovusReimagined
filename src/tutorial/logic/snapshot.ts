import type { TutorialSnapshot } from "../types.js";

let snapshotState: TutorialSnapshot = {};
let tutorialEventsBoundState = false;

export function getSnapshot(): TutorialSnapshot {
  return snapshotState;
}

export function resetSnapshot(): void {
  for (const key of Object.keys(snapshotState)) {
    delete snapshotState[key];
  }
}

export function patchSnapshot(next: Partial<TutorialSnapshot>): void {
  Object.assign(snapshotState, next);
}

export function isTutorialEventsBound(): boolean {
  return tutorialEventsBoundState;
}

export function setTutorialEventsBound(next: boolean): void {
  tutorialEventsBoundState = next;
}
