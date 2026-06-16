import { Client } from "../../state.js";
import {
  tutorialRegionZone,
  getTutorialTrackById,
  trackTotalArcLength,
  TUTORIAL_GATE,
  TUTORIAL_GUNNERY_CENTER,
} from "./layout.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "./controls.js";
import { t } from "../../utils/i18n.js";
import type { TutorialStep } from "../types.js";
import {
  countAliveTargetDummiesInZone,
  hasCombatLoadout,
} from "./bypass.js";
import {
  HANGAR_COMBAT_SWAP_TOUR,
} from "./phases.js";
import { isZoneStepComplete } from "./helpers.js";

export const COMBAT_TRACK_STEPS: TutorialStep[] = [
  {
    id: "hangar-turrets",
    title: t("tutorial.step.hangarTurrets.title"),
    highlight: "#hud-dock-prompt",
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarCombatPhase === "number" ? snapshot.hangarCombatPhase : 0;
        const panel = HANGAR_COMBAT_SWAP_TOUR[phase];
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.hangarTurrets.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0xff8866,
    stationTourGroup: "hangar",
    tour: { phases: HANGAR_COMBAT_SWAP_TOUR, phaseKey: "hangarCombatPhase", completeKey: "hangarReviewComplete" },
    onEnter(ctx) {
      ctx.patchSnapshot({
        hangarCombatPhase: 0,
        hangarCombatPhaseAt: ctx.now,
        hangarReviewStarted: false,
        hangarReviewComplete: false,
        hangarTabActive: false,
      });
    },
    isComplete(ctx) {
      return ctx.snapshot.hangarReviewComplete === true
        && hasCombatLoadout(ctx.player);
    },
  },
  {
    id: "fly-gunnery",
    title: t("tutorial.step.flyGunnery.title"),

    objective: () => t("tutorial.step.flyGunnery.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("tut-gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-gunnery");
      ctx.patchSnapshot({ trackProgressTotal: track ? trackTotalArcLength(track) : 0 });
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("tut-gunnery"));
    },
  },
  {
    id: "gunnery",
    title: t("tutorial.step.gunnery.title"),
    highlight: "#hud-slots",
    objective: () => t("tutorial.step.gunnery.objective", { bar1Key: tutorialBarKeyStyled(0) }),
    zone: tutorialRegionZone("tut-gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const zone = tutorialRegionZone("tut-gunnery");
      ctx.patchSnapshot({ dummyCount: countAliveTargetDummiesInZone(zone, ctx.player) });
    },
    isComplete(ctx) {
      if (ctx.player.kills > 0) return true;
      const zone = tutorialRegionZone("tut-gunnery");
      if (!ctx.inZone(zone)) return false;
      const startCount = ctx.snapshot.dummyCount as number ?? 0;
      return (startCount > 0 && countAliveTargetDummiesInZone(zone, ctx.player) < startCount);
    },
  },
  {
    id: "fly-gate",
    title: t("tutorial.step.flyGate.title"),

    objective: () => t("tutorial.step.flyGate.objective"),
    zone: tutorialRegionZone("tut-gate"),
    beaconColor: 0xffffff,
    gatePulse: true,
    revealsTutorialExitGate: true,
    nav: { trackId: "spoke-gate", label: t("world.location.stargate"), targetX: TUTORIAL_GATE.x, targetY: TUTORIAL_GATE.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-gate");
      ctx.patchSnapshot({ trackProgressTotal: track ? trackTotalArcLength(track) : 0 });
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("tut-gate"));
    },
  },
  {
    id: "graduation",
    title: t("tutorial.step.graduation.title"),
    highlight: "#hud-dock-prompt",
    objective: () => t("tutorial.step.graduation.objective", { dockKey: tutorialKeyStyled("dock") }),
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0xffffff,
    gatePulse: true,
    revealsTutorialExitGate: true,
    allowsTutorialExitWarp: true,
    nextButtonTextKey: "tutorial.graduate",
    completesTutorialOnComplete: true,
    onEnter(ctx) {
      ctx.patchSnapshot({ sysIdx: ctx.player.sysIdx });
    },
    isComplete(ctx) {
      return ctx.player.sysIdx !== 0;
    },
  },
];
