import { t } from "../../utils/i18n.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "./controls.js";

export const HUD_TOUR_PHASES = [
  { label: t("tutorial.hudTour.vitals.label"), body: t("tutorial.hudTour.vitals.body"), target: "#hud-status-bars" },
  { label: t("tutorial.hudTour.modules.label"), body: t("tutorial.hudTour.modules.body"), target: "#hud-slots" },
  { label: t("tutorial.hudTour.lockRail.label"), body: t("tutorial.hudTour.lockRail.body"), target: "#hud-lock-rail" },
  { label: t("tutorial.hudTour.overview.label"), body: t("tutorial.hudTour.overview.body"), target: "#hud-scanner-dock" },
  { label: t("tutorial.hudTour.comms.label"), body: t("tutorial.hudTour.comms.body"), target: "#hud-log-panel" },
  { label: t("tutorial.hudTour.missions.label"), body: t("tutorial.hudTour.missions.body"), target: "#hud-missions" },
];

export const HANGAR_REVIEW_TOUR = [
  { label: t("tutorial.hangar.activeFitting.label"), body: t("tutorial.hangar.activeFitting.body"), target: "#hangar-fitting-panel", tab: "hangar" },
  { label: t("tutorial.hangar.highSlot0.label"), body: t("tutorial.hangar.highSlot0.body"), target: "#hangar-slot-high-0", tab: "hangar" },
  { label: t("tutorial.hangar.cargo.label"), body: t("tutorial.hangar.cargo.body"), target: "#hangar-pane-cargo", tab: "hangar" },
  { label: t("tutorial.hangar.shipStats.label"), body: t("tutorial.hangar.shipStats.body"), target: "#hangar-stats-panel", tab: "hangar" },
  { label: t("tutorial.hangar.trainingMission.label"), body: t("tutorial.hangar.trainingMission.body"), target: "#hangar-missions-panel", tab: "hangar" },
  { label: t("tutorial.hangar.undock.label"), body: t("tutorial.hangar.undock.body", { dockKey: tutorialKeyStyled("dock") }), target: "#st-undock", tab: "hangar" },
];

export const HANGAR_COMBAT_SWAP_TOUR = [
  { label: t("tutorial.hangar.combatLoadout.label"), body: t("tutorial.hangar.combatLoadout.body"), target: "#hangar-fitting-panel", tab: "hangar" },
  { label: t("tutorial.hangar.unfitMiner.label"), body: t("tutorial.hangar.unfitMiner.body"), target: "#hangar-slot-high-0", tab: "hangar" },
  { label: t("tutorial.hangar.unfitTractor.label"), body: t("tutorial.hangar.unfitTractor.body"), target: "#hangar-slot-high-1", tab: "hangar" },
  { label: t("tutorial.hangar.fitAutocannon.label"), body: t("tutorial.hangar.fitAutocannon.body"), target: "#hangar-slot-high-0", tab: "hangar" },
  { label: t("tutorial.hangar.fitSalvager.label"), body: t("tutorial.hangar.fitSalvager.body"), target: "#hangar-slot-high-1", tab: "hangar" },
  { label: t("tutorial.hangar.combatUndock.label"), body: t("tutorial.hangar.combatUndock.body", { dockKey: tutorialKeyStyled("dock") }), target: "#st-undock", tab: "hangar" },
];

export const REFINERY_TOUR = [
  { label: t("tutorial.refining.tab.label"), body: t("tutorial.refining.tab.body"), target: '.st-tab[data-tab="industry"]', tab: "industry" },
  { label: t("tutorial.refining.plant.label"), body: t("tutorial.refining.plant.body"), target: "#refinery-pipeline", tab: "industry" },
  { label: t("tutorial.refining.source.label"), body: t("tutorial.refining.source.body"), target: "#refinery-process-source", tab: "industry" },
  { label: t("tutorial.refining.controls.label"), body: t("tutorial.refining.controls.body"), target: "#refinery-process-controls", tab: "industry" },
  { label: t("tutorial.refining.queue.label"), body: t("tutorial.refining.queue.body", { dockKey: tutorialKeyStyled("dock") }), target: "#refinery-right-rail", tab: "industry" },
];
