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

const HUD_TOUR_PHASES = [
  { label: t("tutorial.hudTour.vitals.label"), body: t("tutorial.hudTour.vitals.body"), target: "#hud-status-bars" },
  { label: t("tutorial.hudTour.modules.label"), body: t("tutorial.hudTour.modules.body"), target: "#hud-slots" },
  { label: t("tutorial.hudTour.lockRail.label"), body: t("tutorial.hudTour.lockRail.body"), target: "#hud-lock-rail" },
  { label: t("tutorial.hudTour.overview.label"), body: t("tutorial.hudTour.overview.body"), target: "#hud-scanner-dock" },
  { label: t("tutorial.hudTour.comms.label"), body: t("tutorial.hudTour.comms.body"), target: "#hud-log-panel" },
  { label: t("tutorial.hudTour.missions.label"), body: t("tutorial.hudTour.missions.body"), target: "#hud-missions" },
];

const HANGAR_REVIEW_TOUR = [
  { label: t("tutorial.hangar.cargo.label"), body: t("tutorial.hangar.cargo.body"), target: "#hangar-pane-cargo", tab: "hangar" },
  { label: t("tutorial.hangar.activeFitting.label"), body: t("tutorial.hangar.activeFitting.body"), target: "#hangar-fitting-panel", tab: "hangar" },
  { label: t("tutorial.hangar.shipStats.label"), body: t("tutorial.hangar.shipStats.body"), target: "#hangar-stats-panel", tab: "hangar" },
  { label: t("tutorial.hangar.trainingMission.label"), body: t("tutorial.hangar.trainingMission.body"), target: "#hangar-missions-panel", tab: "hangar" },
  { label: t("tutorial.hangar.undock.label"), body: t("tutorial.hangar.undock.body", { dockKey: tutorialKeyStyled("dock") }), target: "#st-undock", tab: "hangar" },
];

const HANGAR_COMBAT_SWAP_TOUR = [
  { label: t("tutorial.hangar.combatLoadout.label"), body: t("tutorial.hangar.combatLoadout.body"), target: "#hangar-fitting-panel", tab: "hangar" },
  { label: t("tutorial.hangar.unfitMiner.label"), body: t("tutorial.hangar.unfitMiner.body"), target: '[data-rack="high"][data-idx="0"]', tab: "hangar" },
  { label: t("tutorial.hangar.unfitTractor.label"), body: t("tutorial.hangar.unfitTractor.body"), target: '[data-rack="high"][data-idx="1"]', tab: "hangar" },
  { label: t("tutorial.hangar.fitAutocannon.label"), body: t("tutorial.hangar.fitAutocannon.body"), target: '[data-rack="high"][data-idx="0"]', tab: "hangar" },
  { label: t("tutorial.hangar.fitSalvager.label"), body: t("tutorial.hangar.fitSalvager.body"), target: '[data-rack="high"][data-idx="1"]', tab: "hangar" },
  { label: t("tutorial.hangar.combatUndock.label"), body: t("tutorial.hangar.combatUndock.body", { dockKey: tutorialKeyStyled("dock") }), target: "#st-undock", tab: "hangar" },
];

const REFINERY_TOUR = [
  { label: t("tutorial.refining.tab.label"), body: t("tutorial.refining.tab.body"), target: '.st-tab[data-tab="industry"]', tab: "industry" },
  { label: t("tutorial.refining.plant.label"), body: t("tutorial.refining.plant.body"), target: "#refinery-pipeline", tab: "industry" },
  { label: t("tutorial.refining.source.label"), body: t("tutorial.refining.source.body"), target: "#refinery-process-source", tab: "industry" },
  { label: t("tutorial.refining.controls.label"), body: t("tutorial.refining.controls.body"), target: "#refinery-process-controls", tab: "industry" },
  { label: t("tutorial.refining.queue.label"), body: t("tutorial.refining.queue.body", { dockKey: tutorialKeyStyled("dock") }), target: "#refinery-right-rail", tab: "industry" },
];

function getTourPanelFromStep(step: TutorialStep | undefined, snapshot: Record<string, unknown>): { label: string; body: string; index: number; total: number } | null {
  if (!step?.tour) return null;
  const phase = typeof snapshot[step.tour.phaseKey] === "number" ? snapshot[step.tour.phaseKey] as number : 0;
  const panel = step.tour.phases[phase];
  if (!panel) return null;
  return { label: panel.label, body: panel.body, index: phase + 1, total: step.tour.phases.length };
}

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
    highlight: "#hud-slots",
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
