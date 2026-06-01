import { Client } from "../state.js";
import {
  tutorialRegionZone,
  getTutorialTrackById,
  trackTotalArcLength,
  TUTORIAL_GATE,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_GUNNERY_CENTER,
} from "./tutorial-layout.js";
import { tutorialKey } from "./tutorial-controls.js";
import { getHangarGuidePanel } from "./hangar-tutorial-guide.js";
import { t } from "../utils/i18n.js";
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
    id: "fly-academy",
    title: t("tutorial.step.flyAcademy.title"),
    objective: () => t("tutorial.step.flyAcademy.objective", { mapKey: tutorialKey("map") }),
    hint: () => t("tutorial.step.flyAcademy.hint", { brakeKey: tutorialKey("brake") }),
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
      return t("tutorial.step.hangarHigh.objective", { dockKey: tutorialKey("dock") });
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
    objective: t("tutorial.step.flyMining.objective"),
    hint: t("tutorial.step.flyMining.hint"),
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
    objective: t("tutorial.step.targeting.objective"),
    hint: () => t("tutorial.step.targeting.hint", { overviewKey: tutorialKey("overview"), brakeKey: tutorialKey("brake") }),
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
    objective: t("tutorial.step.mining.objective"),
    hint: () => t("tutorial.step.mining.hint"),
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
    objective: t("tutorial.step.flyStation.objective"),
    hint: t("tutorial.step.flyStation.hint"),
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
    objective: () => t("tutorial.step.industry.objective", { dockKey: tutorialKey("dock") }),
    hint: t("tutorial.step.industry.hint"),
    zone: tutorialRegionZone("industry"),
    beaconColor: 0x88ff88,
    onEnter(ctx) {
      ctx.snapshot.craftQueue = ctx.player.craftQueue.length;
      ctx.snapshot.refined = ctx.player.refined.bar || 0;
    },
    isComplete(ctx) {
      return ctx.player.craftQueue.length > (ctx.snapshot.craftQueue as number ?? 0)
        || (ctx.player.refined.bar || 0) > (ctx.snapshot.refined as number ?? 0)
        || ctx.player.craftQueue.length > 0
        || (ctx.player.refined.bar || 0) > 0
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
      return t("tutorial.step.hangarTurrets.objective", { dockKey: tutorialKey("dock") });
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
    objective: t("tutorial.step.flyGunnery.objective"),
    hint: t("tutorial.step.flyGunnery.hint"),
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
    objective: t("tutorial.step.gunnery.objective"),
    hint: () => t("tutorial.step.gunnery.hint"),
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
    objective: t("tutorial.step.flyGate.objective"),
    hint: t("tutorial.step.flyGate.hint"),
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
    objective: () => t("tutorial.step.graduation.objective", { dockKey: tutorialKey("dock") }),
    hint: () => t("tutorial.step.graduation.hint", { dockKey: tutorialKey("dock") }),
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
