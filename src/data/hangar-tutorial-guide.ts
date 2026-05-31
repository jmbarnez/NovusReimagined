import { tutorialKey } from "./tutorial-controls.js";
import { t } from "../utils/i18n.js";

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
    label: t("tutorial.hangar.cargo.label"),
    target: "hangar-cargo",
    stationTab: "hangar",
    body: t("tutorial.hangar.cargo.body"),
  },
  {
    label: t("tutorial.hangar.activeFitting.label"),
    target: "hangar-fitting",
    stationTab: "hangar",
    body: t("tutorial.hangar.activeFitting.body"),
  },
  {
    label: t("tutorial.hangar.shipStats.label"),
    target: "hangar-stats",
    stationTab: "hangar",
    body: t("tutorial.hangar.shipStats.body"),
  },
  {
    label: t("tutorial.hangar.trainingMission.label"),
    target: "hud-missions",
    body: t("tutorial.hangar.trainingMission.body"),
  },
  {
    label: t("tutorial.hangar.undock.label"),
    target: "hangar-undock",
    stationTab: "hangar",
    body: t("tutorial.hangar.undock.body", { dockKey: tutorialKey("dock") }),
  },
];

export const HANGAR_COMBAT_SWAP_GUIDE: HangarGuidePanel[] = [
  {
    label: t("tutorial.hangar.combatLoadout.label"),
    target: "hangar-fitting",
    stationTab: "hangar",
    body: t("tutorial.hangar.combatLoadout.body"),
  },
  {
    label: t("tutorial.hangar.unfitMiner.label"),
    target: "hangar-slot-high-0",
    stationTab: "hangar",
    body: t("tutorial.hangar.unfitMiner.body"),
  },
  {
    label: t("tutorial.hangar.unfitTractor.label"),
    target: "hangar-slot-high-1",
    stationTab: "hangar",
    body: t("tutorial.hangar.unfitTractor.body"),
  },
  {
    label: t("tutorial.hangar.fitAutocannon.label"),
    target: "hangar-slot-high-0",
    stationTab: "hangar",
    body: t("tutorial.hangar.fitAutocannon.body"),
  },
  {
    label: t("tutorial.hangar.fitSalvager.label"),
    target: "hangar-slot-high-1",
    stationTab: "hangar",
    body: t("tutorial.hangar.fitSalvager.body"),
  },
  {
    label: t("tutorial.hangar.combatUndock.label"),
    target: "hangar-undock",
    stationTab: "hangar",
    body: t("tutorial.hangar.combatUndock.body", { dockKey: tutorialKey("dock") }),
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
