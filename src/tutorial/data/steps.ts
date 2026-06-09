import { Client } from "../../state.js";
import {
  tutorialRegionZone,
  getTutorialTrackById,
  trackTotalArcLength,
  TUTORIAL_GATE,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_GUNNERY_CENTER,
} from "./layout.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "./controls.js";
import { t } from "../../utils/i18n.js";
import { flattenStorageMaterials } from "../../refinery/index.js";
import type { TutorialStep, TutorialCtx } from "../types.js";
import {
  totalOre,
  hasLockOnAsteroid,
  countAliveTargetDummiesInZone,
  isModuleFitted,
  hasCombatLoadout,
  hasBypassedMining,
  hasBypassedIndustry,
  hasBypassedHangarTurrets,
  hasBypassedGunnery,
} from "./bypass.js";
import {
  HUD_TOUR_PHASES,
  HANGAR_REVIEW_TOUR,
  HANGAR_COMBAT_SWAP_TOUR,
  REFINERY_TOUR,
} from "./phases.js";
import { isZoneStepComplete } from "./helpers.js";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "hud-tour",
    title: t("tutorial.step.hudTour.title"),
    objective: (snapshot) => {
      const phase = typeof snapshot?.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
      return t("tutorial.step.hudTour.objective", { n: phase + 1, total: HUD_TOUR_PHASES.length });
    },
    zone: { x: 0, y: 0, r: 0 },
    beaconColor: 0x55aaff,
    tour: { phases: HUD_TOUR_PHASES, phaseKey: "hudTourPhase", completeKey: "hudTourComplete" },
    onEnter(ctx) {
      ctx.snapshot.hudTourPhase = 0;
      ctx.snapshot.hudTourComplete = false;
    },
    isComplete(ctx) {
      return ctx.snapshot.hudTourComplete === true;
    },
  },
  {
    id: "boost-try",
    title: t("tutorial.step.boostTry.title"),
    highlight: "#hud-status-bars",
    objective: () => t("tutorial.step.boostTry.objective", { boostKey: tutorialKeyStyled("engineBoost") }),
    zone: { x: 0, y: 0, r: 0 },
    beaconColor: 0x55aaff,
    onEnter(ctx) {
      ctx.snapshot.boostUsed = false;
    },
    isComplete(ctx) {
      return ctx.snapshot.boostUsed === true;
    },
  },
  {
    id: "fly-academy",
    title: t("tutorial.step.flyAcademy.title"),
    highlight: "#hud-missions",
    objective: () => t("tutorial.step.flyAcademy.objective", {
      mapKey: tutorialKeyStyled("map"),
      forwardKey: tutorialKeyStyled("forwardThrust"),
      reverseKey: tutorialKeyStyled("reverseThrust"),
      leftKey: tutorialKeyStyled("turnLeft"),
      rightKey: tutorialKeyStyled("turnRight"),
      brakeKey: tutorialKeyStyled("brake"),
    }),
    zone: tutorialRegionZone("fly-academy"),
    beaconColor: 0x55aaff,
    nav: { trackId: "approach", label: t("world.location.academy"), targetX: 0, targetY: 0 },
    onEnter(ctx) {
      const track = getTutorialTrackById("approach");
      ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("fly-academy"))
        || Client.stationOpen
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
    zone: tutorialRegionZone("hangar-high"),
    beaconColor: 0x88ff88,
    tour: { phases: HANGAR_REVIEW_TOUR, phaseKey: "hangarReviewPhase", completeKey: "hangarReviewComplete" },
    onEnter(ctx) {
      ctx.snapshot.minerInHigh = isModuleFitted("tu-civilian-miner", "high", ctx.player);
      ctx.snapshot.hangarReviewPhase = 0;
      ctx.snapshot.hangarReviewPhaseAt = ctx.now;
      ctx.snapshot.hangarReviewStarted = false;
      ctx.snapshot.hangarReviewComplete = false;
      ctx.snapshot.hangarTabActive = false;
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
    highlight: "#hud-missions",
    objective: () => t("tutorial.step.flyMining.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("fly-mining"),
    beaconColor: 0x88ccff,
    nav: { trackId: "spoke-mining", label: t("world.region.miningRange"), targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-mining");
      ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("fly-mining"))
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "targeting",
    title: t("tutorial.step.targeting.title"),
    highlight: "#hud-scanner-dock",
    objective() {
      const key = Client.settings.movementControlMode === "direct"
        ? "tutorial.step.targeting.objectiveDirect"
        : "tutorial.step.targeting.objective";
      const lockActionText = Client.settings.movementControlMode === "direct"
        ? t("tutorial.action.shiftLeftClick")
        : t("tutorial.action.leftClick");
      const lockAction = `<span class="tutorial-keybind">${lockActionText}</span>`;
      return t(key, { overviewKey: tutorialKeyStyled("overview"), brakeKey: tutorialKeyStyled("brake"), lockAction });
    },
    zone: tutorialRegionZone("targeting"),
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
    objective: () => t("tutorial.step.mining.objective", { bar1Key: tutorialBarKeyStyled(0) }),
    zone: tutorialRegionZone("mining"),
    beaconColor: 0xaa88ff,
    nav: { trackId: "spoke-mining", label: t("world.region.miningRange"), targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
    onEnter(ctx) {
      ctx.snapshot.ore = totalOre(ctx.player);
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
    highlight: "#hud-dock-prompt",
    objective: () => t("tutorial.step.flyStation.objective"),
    zone: tutorialRegionZone("fly-station"),
    beaconColor: 0x88ff88,
    nav: { trackId: "spoke-mining-return", label: t("world.location.academy"), targetX: 0, targetY: 0 },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-mining-return");
      ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("fly-station"))
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
    zone: tutorialRegionZone("industry"),
    beaconColor: 0x88ff88,
    tour: { phases: REFINERY_TOUR, phaseKey: "refineryGuidePhase", completeKey: "refineryGuideComplete" },
    onEnter(ctx) {
      ctx.snapshot.craftQueue = ctx.player.craftQueue.length;
      ctx.snapshot.hubQueue = ctx.player.hubQueue.length;
      ctx.snapshot.materialVolume = (ctx.player.bulkMaterialsCargo ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
      ctx.snapshot.refineryMaterialVolume = [
        ...flattenStorageMaterials(ctx.player.refineryStorage),
        ...(ctx.player.hubDeposit.materials ?? []),
      ].reduce((sum, stack) => sum + stack.volumeM3, 0)
        + (ctx.player.hubOutput.materials ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
      ctx.snapshot.refineryGuidePhase = 0;
      ctx.snapshot.refineryGuideStarted = false;
      ctx.snapshot.refineryGuideComplete = false;
      ctx.snapshot.industryTabActive = false;
    },
    isComplete(ctx) {
      const guideReady = (ctx.snapshot.refineryGuidePhase as number ?? 0) >= 4;
      const didRefineryWork = ctx.player.craftQueue.length > (ctx.snapshot.craftQueue as number ?? 0)
        || ctx.player.hubQueue.length > (ctx.snapshot.hubQueue as number ?? 0)
        || (ctx.player.bulkMaterialsCargo ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0) > (ctx.snapshot.materialVolume as number ?? 0)
        || ([
          ...flattenStorageMaterials(ctx.player.refineryStorage),
          ...(ctx.player.hubDeposit.materials ?? []),
        ].reduce((sum, stack) => sum + stack.volumeM3, 0)
          + (ctx.player.hubOutput.materials ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0)) > (ctx.snapshot.refineryMaterialVolume as number ?? 0)
        || ctx.player.craftQueue.length > 0
        || ctx.player.hubQueue.length > 0
        || (ctx.player.bulkMaterialsCargo ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0) > 0
        || ([
          ...flattenStorageMaterials(ctx.player.refineryStorage),
          ...(ctx.player.hubDeposit.materials ?? []),
        ].reduce((sum, stack) => sum + stack.volumeM3, 0)
          + (ctx.player.hubOutput.materials ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0)) > 0;
      return (guideReady && didRefineryWork)
        || hasBypassedHangarTurrets(ctx.player);
    },
  },
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
    zone: tutorialRegionZone("hangar-turrets"),
    beaconColor: 0xff8866,
    tour: { phases: HANGAR_COMBAT_SWAP_TOUR, phaseKey: "hangarCombatPhase", completeKey: "hangarReviewComplete" },
    onEnter(ctx) {
      ctx.snapshot.hangarCombatPhase = 0;
      ctx.snapshot.hangarCombatPhaseAt = ctx.now;
      ctx.snapshot.hangarReviewStarted = false;
      ctx.snapshot.hangarReviewComplete = false;
      ctx.snapshot.hangarTabActive = false;
    },
    isComplete(ctx) {
      if (ctx.snapshot.hangarReviewComplete === true) return true;
      if (hasCombatLoadout(ctx.player) && !Client.stationOpen) return true;
      return (ctx.snapshot.hangarReviewStarted === true
        && hasCombatLoadout(ctx.player)
        && !Client.stationOpen)
        || hasBypassedGunnery(ctx.player);
    },
  },
  {
    id: "fly-gunnery",
    title: t("tutorial.step.flyGunnery.title"),
    highlight: "#hud-missions",
    objective: () => t("tutorial.step.flyGunnery.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("fly-gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-gunnery");
      ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("fly-gunnery"))
        || hasBypassedGunnery(ctx.player);
    },
  },
  {
    id: "gunnery",
    title: t("tutorial.step.gunnery.title"),
    highlight: "#hud-slots",
    objective: () => t("tutorial.step.gunnery.objective", { bar1Key: tutorialBarKeyStyled(0) }),
    zone: tutorialRegionZone("gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const zone = tutorialRegionZone("gunnery");
      ctx.snapshot.dummyCount = countAliveTargetDummiesInZone(zone, ctx.player);
    },
    isComplete(ctx) {
      if (ctx.player.kills > 0 || ctx.player.sysIdx !== 0) return true;
      const zone = tutorialRegionZone("gunnery");
      if (!ctx.inZone(zone)) return false;
      const startCount = ctx.snapshot.dummyCount as number ?? 0;
      return (startCount > 0 && countAliveTargetDummiesInZone(zone, ctx.player) < startCount);
    },
  },
  {
    id: "fly-gate",
    title: t("tutorial.step.flyGate.title"),
    highlight: "#hud-missions",
    objective: () => t("tutorial.step.flyGate.objective"),
    zone: tutorialRegionZone("fly-gate"),
    beaconColor: 0xffffff,
    nav: { trackId: "spoke-gate", label: t("world.location.stargate"), targetX: TUTORIAL_GATE.x, targetY: TUTORIAL_GATE.y },
    onEnter(ctx) {
      const track = getTutorialTrackById("spoke-gate");
      ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
    },
    isComplete(ctx) {
      return isZoneStepComplete(ctx, tutorialRegionZone("fly-gate"))
        || ctx.player.sysIdx !== 0;
    },
  },
  {
    id: "graduation",
    title: t("tutorial.step.graduation.title"),
    highlight: "#hud-dock-prompt",
    objective: () => t("tutorial.step.graduation.objective", { dockKey: tutorialKeyStyled("dock") }),
    zone: tutorialRegionZone("graduation"),
    beaconColor: 0xffffff,
    onEnter(ctx) {
      ctx.snapshot.sysIdx = ctx.player.sysIdx;
    },
    isComplete(ctx) {
      return ctx.player.sysIdx !== 0;
    },
  },
];
