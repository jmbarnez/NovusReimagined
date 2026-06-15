import type { TutorialStep } from "../types.js";
import { MINING_TRACK_STEPS } from "./mining-track-steps.js";
import { COMBAT_TRACK_STEPS } from "./combat-track-steps.js";

export const TUTORIAL_STEPS: TutorialStep[] = [
  ...MINING_TRACK_STEPS,
  ...COMBAT_TRACK_STEPS,
];
