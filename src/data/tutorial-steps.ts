import { Client } from "../state.js";
import {
  tutorialRegionZone,
  getTutorialTrackById,
  trackTotalArcLength,
  TUTORIAL_GATE,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_GUNNERY_CENTER,
} from "./tutorial-layout.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "./tutorial-controls.js";
import { getHangarGuidePanel } from "./hangar-tutorial-guide.js";
import { getRefineryGuidePanel } from "./refinery-tutorial-guide.js";
import { t } from "../utils/i18n.js";
import { flattenStorageMaterials } from "../refinery/index.js";
import {
  type TutorialZone,
  type TutorialCtx,
  type TutorialStep,
  totalOre,
  hasLockOnAsteroid,
  countAliveTargetDummiesInZone,
  isModuleFitted,
  hasCombatLoadout,
  hasBypassedMining,
  hasBypassedIndustry,
  hasBypassedHangarTurrets,
  hasBypassedGunnery,
} from "./tutorial-bypass.js";

function findStep(id: string): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((s) => s.id === id);
}

export function isZoneStepComplete(ctx: TutorialCtx, zone: TutorialZone): boolean {
  return ctx.snapshot.zoneReached === true || ctx.inZone(zone);
}

function totalBulkMaterialVolume(player: TutorialCtx["player"]): number {
  return (player.bulkMaterialsCargo ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
}

function totalRefineryMaterialVolume(player: TutorialCtx["player"]): number {
  const deposit = [
    ...flattenStorageMaterials(player.refineryStorage),
    ...(player.hubDeposit.materials ?? []),
  ].reduce((sum, stack) => sum + stack.volumeM3, 0);
  const output = (player.hubOutput.materials ?? []).reduce((sum, stack) => sum + stack.volumeM3, 0);
  return deposit + output;
}

function initTrackProgress(ctx: TutorialCtx, trackId: string): void {
  const track = getTutorialTrackById(trackId);
  ctx.snapshot.trackProgressTotal = track ? trackTotalArcLength(track) : 0;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "hud-tour",
    title: t("tutorial.step.hudTour.title"),
    objective: (snapshot) => {
      const phase = typeof snapshot?.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
      return t("tutorial.step.hudTour.objective", { n: phase + 1, total: 6 });
    },
    zone: { x: 0, y: 0, r: 0 },
    beaconColor: 0x55aaff,
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
      initTrackProgress(ctx, "approach");
    },
    isComplete(ctx) {
      const step = findStep("fly-academy");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || Client.stationOpen
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "hangar-high",
    title: t("tutorial.step.hangarHigh.title"),
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarReviewPhase === "number" ? snapshot.hangarReviewPhase : 0;
        const panel = getHangarGuidePanel("hangar-high", phase);
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.hangarHigh.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("hangar-high"),
    beaconColor: 0x88ff88,
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
    objective: () => t("tutorial.step.flyMining.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("fly-mining"),
    beaconColor: 0x88ccff,
    nav: { trackId: "spoke-mining", label: t("world.region.miningRange"), targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
    onEnter(ctx) {
      initTrackProgress(ctx, "spoke-mining");
    },
    isComplete(ctx) {
      const step = findStep("fly-mining");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "targeting",
    title: t("tutorial.step.targeting.title"),
    objective() {
      const key = Client.settings.movementControlMode === "direct"
        ? "tutorial.step.targeting.objectiveDirect"
        : "tutorial.step.targeting.objective";
      return t(key, { overviewKey: tutorialKeyStyled("overview"), brakeKey: tutorialKeyStyled("brake") });
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
    objective: () => t("tutorial.step.flyStation.objective"),
    zone: tutorialRegionZone("fly-station"),
    beaconColor: 0x88ff88,
    nav: { trackId: "spoke-mining-return", label: t("world.location.academy"), targetX: 0, targetY: 0 },
    onEnter(ctx) {
      initTrackProgress(ctx, "spoke-mining-return");
    },
    isComplete(ctx) {
      const step = findStep("fly-station");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || Client.stationOpen
        || hasBypassedIndustry(ctx.player);
    },
  },
  {
    id: "industry",
    title: t("tutorial.step.industry.title"),
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.refineryGuideComplete !== true) {
        const phase = typeof snapshot?.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
        const panel = getRefineryGuidePanel("industry", phase);
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.industry.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("industry"),
    beaconColor: 0x88ff88,
    onEnter(ctx) {
      ctx.snapshot.craftQueue = ctx.player.craftQueue.length;
      ctx.snapshot.hubQueue = ctx.player.hubQueue.length;
      ctx.snapshot.materialVolume = totalBulkMaterialVolume(ctx.player);
      ctx.snapshot.refineryMaterialVolume = totalRefineryMaterialVolume(ctx.player);
      ctx.snapshot.refineryGuidePhase = 0;
      ctx.snapshot.refineryGuideStarted = false;
      ctx.snapshot.refineryGuideComplete = false;
      ctx.snapshot.industryTabActive = false;
    },
    isComplete(ctx) {
      const guideReady = (ctx.snapshot.refineryGuidePhase as number ?? 0) >= 4;
      const didRefineryWork = ctx.player.craftQueue.length > (ctx.snapshot.craftQueue as number ?? 0)
        || ctx.player.hubQueue.length > (ctx.snapshot.hubQueue as number ?? 0)
        || totalBulkMaterialVolume(ctx.player) > (ctx.snapshot.materialVolume as number ?? 0)
        || totalRefineryMaterialVolume(ctx.player) > (ctx.snapshot.refineryMaterialVolume as number ?? 0)
        || ctx.player.craftQueue.length > 0
        || ctx.player.hubQueue.length > 0
        || totalBulkMaterialVolume(ctx.player) > 0
        || totalRefineryMaterialVolume(ctx.player) > 0;
      return (guideReady && didRefineryWork)
        || hasBypassedHangarTurrets(ctx.player);
    },
  },
  {
    id: "hangar-turrets",
    title: t("tutorial.step.hangarTurrets.title"),
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarCombatPhase === "number" ? snapshot.hangarCombatPhase : 0;
        const panel = getHangarGuidePanel("hangar-turrets", phase);
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return t("tutorial.step.hangarTurrets.objective", { dockKey: tutorialKeyStyled("dock") });
    },
    zone: tutorialRegionZone("hangar-turrets"),
    beaconColor: 0xff8866,
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
    objective: () => t("tutorial.step.flyGunnery.objective", { bar1Key: tutorialBarKeyStyled(0), bar2Key: tutorialBarKeyStyled(1) }),
    zone: tutorialRegionZone("fly-gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      initTrackProgress(ctx, "spoke-gunnery");
    },
    isComplete(ctx) {
      const step = findStep("fly-gunnery");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || hasBypassedGunnery(ctx.player);
    },
  },
  {
    id: "gunnery",
    title: t("tutorial.step.gunnery.title"),
    objective: () => t("tutorial.step.gunnery.objective", { bar1Key: tutorialBarKeyStyled(0) }),
    zone: tutorialRegionZone("gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: t("world.region.gunneryBay"), targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const step = findStep("gunnery");
      ctx.snapshot.dummyCount = step ? countAliveTargetDummiesInZone(step.zone, ctx.player) : 0;
    },
    isComplete(ctx) {
      const step = findStep("gunnery");
      if (!step) return false;
      if (ctx.player.kills > 0 || ctx.player.sysIdx !== 0) return true;
      if (!ctx.inZone(step.zone)) return false;
      const startCount = ctx.snapshot.dummyCount as number ?? 0;
      return (startCount > 0 && countAliveTargetDummiesInZone(step.zone, ctx.player) < startCount);
    },
  },
  {
    id: "fly-gate",
    title: t("tutorial.step.flyGate.title"),
    objective: () => t("tutorial.step.flyGate.objective"),
    zone: tutorialRegionZone("fly-gate"),
    beaconColor: 0xffffff,
    nav: { trackId: "spoke-gate", label: t("world.location.stargate"), targetX: TUTORIAL_GATE.x, targetY: TUTORIAL_GATE.y },
    onEnter(ctx) {
      initTrackProgress(ctx, "spoke-gate");
    },
    isComplete(ctx) {
      const step = findStep("fly-gate");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || ctx.player.sysIdx !== 0;
    },
  },
  {
    id: "graduation",
    title: t("tutorial.step.graduation.title"),
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
