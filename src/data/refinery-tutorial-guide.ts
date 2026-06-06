import { tutorialKeyStyled } from "./tutorial-controls.js";
import { t } from "../utils/i18n.js";

export type RefineryGuideTarget =
  | "station-tab-industry"
  | "refinery-pipeline"
  | "refinery-process-list"
  | "refinery-process-source"
  | "refinery-process-controls"
  | "refinery-right-rail";

export interface RefineryGuidePanel {
  label: string;
  body: string;
  target: RefineryGuideTarget;
  stationTab?: "industry";
}

export const REFINERY_GUIDE: RefineryGuidePanel[] = [
  {
    label: t("tutorial.refining.tab.label"),
    target: "station-tab-industry",
    stationTab: "industry",
    body: t("tutorial.refining.tab.body"),
  },
  {
    label: t("tutorial.refining.plant.label"),
    target: "refinery-pipeline",
    stationTab: "industry",
    body: t("tutorial.refining.plant.body"),
  },
  {
    label: t("tutorial.refining.source.label"),
    target: "refinery-process-source",
    stationTab: "industry",
    body: t("tutorial.refining.source.body"),
  },
  {
    label: t("tutorial.refining.controls.label"),
    target: "refinery-process-controls",
    stationTab: "industry",
    body: t("tutorial.refining.controls.body"),
  },
  {
    label: t("tutorial.refining.queue.label"),
    target: "refinery-right-rail",
    stationTab: "industry",
    body: t("tutorial.refining.queue.body", { dockKey: tutorialKeyStyled("dock") }),
  },
];

export const REFINERY_GUIDE_PHASE_COUNT = REFINERY_GUIDE.length;

export function getRefineryGuidePanel(stepId: string, phase: number): RefineryGuidePanel | null {
  if (stepId !== "industry") return null;
  if (phase < 0 || phase >= REFINERY_GUIDE.length) return null;
  return REFINERY_GUIDE[phase] ?? null;
}
