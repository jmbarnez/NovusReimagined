import { tutorialKey } from "./tutorial-controls.js";

export type HangarGuideTarget =
  | "station-tab-hangar"
  | "hangar-fitting"
  | "hangar-stats"
  | "hangar-cargo"
  | "hud-missions"
  | "hangar-undock"
  | "hangar-slot-high-0"
  | "hangar-slot-high-1";

export interface HangarGuidePanel {
  label: string;
  body: string;
  target: HangarGuideTarget;
  stationTab?: "hangar" | "contracts" | "market" | "industry";
}

export const HANGAR_REVIEW_GUIDE: HangarGuidePanel[] = [
  {
    label: "Ship Cargo",
    target: "hangar-cargo",
    stationTab: "hangar",
    body: "Your full cargo hold, shared with flight. Use it to inspect modules and fit or unfit gear. The autocannon and salvager wait here until the combat swap.",
  },
  {
    label: "Active Fitting",
    target: "hangar-fitting",
    stationTab: "hangar",
    body: "Your current training fit has a mining laser in high slot 1, a tractor beam in high slot 2, and a survey scanner in low slot 1.",
  },
  {
    label: "Ship Statistics",
    target: "hangar-stats",
    stationTab: "hangar",
    body: "Hull, shields, powergrid, and CPU update here. Hover a fitting action to preview stat changes before committing.",
  },
  {
    label: "Training Mission",
    target: "hud-missions",
    body: "Academy Training tracks your overall progress under the minimap. Each step pays credits and skill XP, with a larger graduation bonus at the end.",
  },
  {
    label: "Undock",
    target: "hangar-undock",
    stationTab: "hangar",
    body: `Press ${tutorialKey("dock")} or click Undock when you are ready — the mining range is next on the tutorial lane.`,
  },
];

export const HANGAR_COMBAT_SWAP_GUIDE: HangarGuidePanel[] = [
  {
    label: "Combat Loadout",
    target: "hangar-fitting",
    stationTab: "hangar",
    body: "The belt used mining tools. Gunnery needs the autocannon and salvager from cargo, so swap both high slots to the combat fit.",
  },
  {
    label: "Unfit Mining Laser",
    target: "hangar-slot-high-0",
    stationTab: "hangar",
    body: "Unfit the mining laser from high slot 1 using the Unfit control. The module returns to cargo.",
  },
  {
    label: "Unfit Tractor Beam",
    target: "hangar-slot-high-1",
    stationTab: "hangar",
    body: "Unfit the tractor beam from high slot 2 the same way. Both mining modules stay in cargo if you need them again.",
  },
  {
    label: "Fit Autocannon",
    target: "hangar-slot-high-0",
    stationTab: "hangar",
    body: "Select the Civilian Autocannon from the slot menu and click Fit to install it in high slot 1.",
  },
  {
    label: "Fit Salvager",
    target: "hangar-slot-high-1",
    stationTab: "hangar",
    body: "Fit the Civilian Salvager into high slot 2. Salvagers strip wrecks — you will use weapons at the gunnery bay.",
  },
  {
    label: "Undock",
    target: "hangar-undock",
    stationTab: "hangar",
    body: `When both combat modules are fitted, press ${tutorialKey("dock")} or click Undock — the gunnery spoke is next.`,
  },
];

export const HANGAR_REVIEW_PHASE_COUNT = HANGAR_REVIEW_GUIDE.length;
export const HANGAR_COMBAT_SWAP_PHASE_COUNT = HANGAR_COMBAT_SWAP_GUIDE.length;

export function getHangarGuidePanels(stepId: string): HangarGuidePanel[] | null {
  if (stepId === "hangar-high") return HANGAR_REVIEW_GUIDE;
  if (stepId === "hangar-turrets") return HANGAR_COMBAT_SWAP_GUIDE;
  return null;
}

export function getHangarGuidePanel(stepId: string, phase: number): HangarGuidePanel | null {
  const panels = getHangarGuidePanels(stepId);
  if (!panels || phase < 0 || phase >= panels.length) return null;
  return panels[phase] ?? null;
}

/** @deprecated Use getHangarGuidePanel("hangar-high", phase)?.body */
export function getHangarReviewHint(phase: number): string {
  return getHangarGuidePanel("hangar-high", phase)?.body ?? "";
}

/** @deprecated Use getHangarGuidePanel("hangar-turrets", phase)?.body */
export function getHangarCombatSwapHint(phase: number): string {
  return getHangarGuidePanel("hangar-turrets", phase)?.body ?? "";
}
