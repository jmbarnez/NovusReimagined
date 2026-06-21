import { Client } from "../../state.js";
import {
  tutorialRegionZone,
  getTutorialTrackById,
  trackTotalArcLength,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_STATION,
} from "./layout.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "./controls.js";
import { t } from "../../utils/i18n.js";
import { flattenStorageMaterials } from "../../refinery/storage.js";
import type { TutorialStep } from "../types.js";
import {
  totalOre,
  hasLockOnAsteroid,
  isModuleFitted,
  hasBypassedMining,
  hasBypassedIndustry,
} from "./bypass.js";
import {
  HANGAR_REVIEW_TOUR,
  REFINERY_TOUR,
} from "./phases.js";
import { isZoneStepComplete } from "./helpers.js";

export const MINING_TRACK_STEPS: TutorialStep[] = [
  {
    id: "piloting-choice",
    title: t("tutorial.step.pilotingChoice.title"),
    objective: () => t("tutorial.step.pilotingChoice.objective", {
      forwardKey: tutorialKeyStyled("forwardThrust"),
      leftKey: tutorialKeyStyled("turnLeft"),
      rightKey: tutorialKeyStyled("turnRight"),
    }),
    zone: { x: 0, y: 0, r: 0 },
    beaconColor: 0x55aaff,
    noDimmer: true,
    guideTarget: TUTORIAL_STATION,
    onEnter(ctx) {
      ctx.patchSnapshot({ pilotingTried: false });
    },
    isComplete(ctx) {
      return ctx.snapshot.pilotingTried === true;
    },
  },
  {
    id: "boost-try",
    title: t("tutorial.step.boostTry.title"),
    highlight: "#hud-boost-status",
    objective: () => t("tutorial.step.boostTry.objective", { boostKey: tutorialKeyStyled("engineBoost") }),
    zone: { x: 0, y: 0, r: 0 },
    beaconColor: 0x55aaff,
    noDimmer: true,
    guideTarget: TUTORIAL_STATION,
    onEnter(ctx) {
      ctx.patchSnapshot({ boostUsed: false });
    },
    isComplete(ctx) {
      return ctx.snapshot.boostUsed === true;
    },
  },
  {
    id: "fly-academy",
    title: t("tutorial.step.flyAcademy.title"),
    objective: () => t("tutorial.step.flyAcademy.objective", {
      mapKey: tutorialKeyStyled("map"),
      forwardKey: tutorialKeyStyled("forwardThrust"),
      reverseKey: tutorialKeyStyled("reverseThrust"),
      leftKey: tutorialKeyStyled("turnLeft"),
      rightKey: tutorialKeyStyled("turnRight"),
      brakeKey: tutorialKeyStyled("brake"),
    }),
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0x55aaff,
    nav: { trackId: "approach", label: t("world.location.academy"), targetX: 0, targetY: 0 },
    onEnter(ctx) {
      const track = getTutorialTrackById("approach");
      ctx.patchSnapshot({ trackProgressTotal: track ? trackTotalArcLength(track) : 0 });
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("tut-hub"))
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "hangar-high",
    title: t("tutorial.step.hangarHigh.title"),
    highlight: "#hud-dock-prompt",
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarReviewPhase === "number" ? snapshot.hangarReviewPhase : 0;
        const panel = HANGAR_REVIEW_TOUR[phase];
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.hangarHigh.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0x88ff88,
    stationTourGroup: "hangar",
    autoAdvanceOnComplete: true,
    tour: { phases: HANGAR_REVIEW_TOUR, phaseKey: "hangarReviewPhase", completeKey: "hangarReviewComplete" },
    onEnter(ctx) {
      ctx.patchSnapshot({
        minerInHigh: isModuleFitted("tu-civilian-miner", "high", ctx.player),
        hangarReviewPhase: 0,
        hangarReviewPhaseAt: ctx.now,
        hangarReviewStarted: false,
        hangarReviewComplete: false,
        hangarTabActive: false,
      });
    },
    isComplete(ctx) {
      if (ctx.snapshot.hangarReviewComplete === true) return true;
      return (ctx.snapshot.hangarReviewStarted === true && !Client.stationOpen)
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "fly-mining",
    title: t("tutorial.step.flyMining.title"),

    objective: () => t("tutorial.step.flyMining.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("tut-mining"),
    beaconColor: 0x88ccff,
    nav: { trackId: "spoke-mining", label: t("world.region.miningRange"), targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-mining");
      ctx.patchSnapshot({ trackProgressTotal: track ? trackTotalArcLength(track) : 0 });
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("tut-mining"))
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "targeting",
    title: t("tutorial.step.targeting.title"),
    highlight: "#hud-scanner-dock",
    objective() {
      return t("tutorial.step.targeting.objectiveDirect", { overviewKey: tutorialKeyStyled("overview"), brakeKey: tutorialKeyStyled("brake") });
    },
    zone: tutorialRegionZone("tut-mining"),
    beaconColor: 0x88ccff,
    isComplete(ctx) {
      return hasLockOnAsteroid(ctx.player)
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "mining",
    title: t("tutorial.step.mining.title"),
    highlight: "#hud-slots",
    noDimmer: true,
    noCardAnchor: true,
    objective: () => t("tutorial.step.mining.objective", { bar1Key: tutorialBarKeyStyled(0) }),
    zone: tutorialRegionZone("tut-mining"),
    beaconColor: 0xaa88ff,
    nav: { trackId: "spoke-mining", label: t("world.region.miningRange"), targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
    onEnter(ctx) {
      ctx.patchSnapshot({ ore: totalOre(ctx.player) });
    },
    isComplete(ctx) {
      return totalOre(ctx.player) > (ctx.snapshot.ore as number ?? 0)
        || totalOre(ctx.player) > 0
        || hasBypassedIndustry(ctx.player);
    },
  },
  {
    id: "fly-station",
    title: t("tutorial.step.flyStation.title"),
    objective: () => t("tutorial.step.flyStation.objective"),
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0x88ff88,
    nav: { trackId: "spoke-mining-return", label: t("world.location.academy"), targetX: 0, targetY: 0 },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-mining-return");
      ctx.patchSnapshot({ trackProgressTotal: track ? trackTotalArcLength(track) : 0 });
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("tut-hub"))
        || Client.stationOpen
        || hasBypassedIndustry(ctx.player);
    },
  },
  {
    id: "industry",
    title: t("tutorial.step.industry.title"),
    highlight: "#hud-dock-prompt",
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.refineryGuideComplete !== true) {
        const phase = typeof snapshot?.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
        const panel = REFINERY_TOUR[phase];
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.industry.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("tut-hub"),
    beaconColor: 0x88ff88,
    stationTourGroup: "industry",
    forceIndustryQueueRail: true,
    autoCompleteTourOnLastPhase: true,
    tour: { phases: REFINERY_TOUR, phaseKey: "refineryGuidePhase", completeKey: "refineryGuideComplete" },
    onEnter(ctx) {
      const materialVolume = (ctx.player.bulkMaterialsCargo ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
      const refineryMaterialVolume = [
        ...flattenStorageMaterials(ctx.player.refineryStorage),
        ...(ctx.player.hubDeposit.materials ?? []),
      ].reduce((sum, stack) => sum + stack.volumeM3, 0)
        + (ctx.player.hubOutput.materials ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
      ctx.patchSnapshot({
        craftQueue: ctx.player.hubQueue.length,
        craftStorage: materialVolume + refineryMaterialVolume,
        refineryGuidePhase: 0,
        refineryGuidePhaseAt: ctx.now,
        refineryGuideComplete: false,
      });
    },
    isComplete(ctx) {
      if (ctx.snapshot.refineryGuideComplete === true) return true;
      return (Client.stationOpen && (ctx.player.hubQueue?.length ?? 0) > 0)
        || hasBypassedIndustry(ctx.player);
    },
  },
];
