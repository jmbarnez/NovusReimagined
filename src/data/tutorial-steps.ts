import { Client } from "../state.js";
import { resetTutorialTrainingSite } from "../world/hidden-sites.js";
import {
  TUTORIAL_TRAINING_SITE_ID,
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
} from "./tutorial-site.js";
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
import {
  type TutorialZone,
  type TutorialCtx,
  type TutorialStep,
  totalOre,
  hasLockOnAsteroid,
  countAliveTargetDummiesInZone,
  isTrainingSiteResolved,
  isTrainingSiteComplete,
  isModuleFitted,
  hasCombatLoadout,
  hasBypassedMining,
  hasBypassedIndustry,
  hasBypassedHangarTurrets,
  hasBypassedGunnery,
  hasBypassedScan,
  hasBypassedBreach,
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
    title: "HUD Overview",
    objective: (snapshot) => {
      const phase = typeof snapshot?.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
      return `Review HUD panel ${phase + 1} of 6, then press Next`;
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
    title: "Academy Approach",
    objective: () =>
      `Fly east to the Academy hub — follow the guide lane, fly through each slingshot gate for a boost, or open the system map (${tutorialKey("map")}) and click the Academy for a nav waypoint`,
    hint: () =>
      `Right-click ahead to set course. Thread each gate between the pillars for a slingshot boost. ${tutorialKey("brake")} to slow down.`,
    zone: tutorialRegionZone("fly-academy"),
    beaconColor: 0x55aaff,
    nav: { trackId: "approach", label: "Academy", targetX: 0, targetY: 0 },
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
    title: "Hangar — Hardpoints",
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarReviewPhase === "number" ? snapshot.hangarReviewPhase : 0;
        const panel = getHangarGuidePanel("hangar-high", phase);
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return `Dock at the Academy (${tutorialKey("dock")}), review the Hangar walkthrough, then undock to continue toward the mining range`;
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
    title: "Mining Spoke",
    objective: "Follow the guide lane from the Academy to the Mining Range asteroid belt",
    hint: "Your mining laser is in high slot 1 (hotkey 1) and the tractor beam is in slot 2. Chevrons mark the lane — fly through each gate opening for a slingshot boost.",
    zone: tutorialRegionZone("fly-mining"),
    beaconColor: 0x88ccff,
    nav: { trackId: "spoke-mining", label: "Mining Range", targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
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
    title: "Scanner Range",
    objective: "Left-click an asteroid to request a sensor lock, then wait for the lock to resolve",
    hint: () =>
      `Asteroids show on your overview (${tutorialKey("overview")}) and as contacts on the lock rail. ${tutorialKey("brake")} to hold position while the scan completes — the lock card fills as resolution progresses.`,
    zone: tutorialRegionZone("targeting"),
    beaconColor: 0x88ccff,
    isComplete(ctx) {
      return hasLockOnAsteroid(ctx.player)
        || hasBypassedMining(ctx.player);
    },
  },
  {
    id: "mining",
    title: "Mining Range",
    objective: "Power the mining laser, assign it to your asteroid lock, fly into range, and collect ore",
    hint: () =>
      `Press 1 to activate the civilian mining laser in high slot 1. Click your resolved lock card, then click that slot to assign. Fly close until the mining beam connects.`,
    zone: tutorialRegionZone("mining"),
    beaconColor: 0xaa88ff,
    nav: { trackId: "spoke-mining", label: "Mining Range", targetX: TUTORIAL_BELT_CENTER.x, targetY: TUTORIAL_BELT_CENTER.y },
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
    title: "Return to Academy",
    objective: "Follow the guide lane back to the Academy hub with your mined ore",
    hint: "Fly the return spoke — pass through the boost gates. Once docked, Industry can refine the ore you collected.",
    zone: tutorialRegionZone("fly-station"),
    beaconColor: 0x88ff88,
    nav: { trackId: "spoke-mining-return", label: "Academy", targetX: 0, targetY: 0 },
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
    title: "Industry Bench",
    objective: () =>
      `Dock at the Academy (${tutorialKey("dock")}), open Industry, and queue Ferro bar refining`,
    hint: "Dock at the central station, open Industry, choose Smelter, then queue Ferro bar refining. The queue panel shows live progress while the job runs.",
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
    title: "Hangar — Combat Loadout",
    objective: (snapshot) => {
      if (Client.stationOpen && snapshot?.hangarReviewComplete !== true) {
        const phase = typeof snapshot?.hangarCombatPhase === "number" ? snapshot.hangarCombatPhase : 0;
        const panel = getHangarGuidePanel("hangar-turrets", phase);
        if (panel) return `${panel.label}: ${panel.body}`;
      }
      return `Dock at the Academy (${tutorialKey("dock")}), open Hangar, swap the mining laser and tractor for the autocannon and salvager, then undock`;
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
    title: "Gunnery Spoke",
    objective: "Follow the guide lane from the Academy to the gunnery bay",
    hint: "Your autocannon should be in high slot 1 (hotkey 1) and salvager in slot 2. Revisit the Hangar if you still have mining modules fitted.",
    zone: tutorialRegionZone("fly-gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: "Gunnery Bay", targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
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
    title: "Gunnery Bay",
    objective: "Lock a target dummy and destroy it with your autocannon (high slot 1)",
    hint: () =>
      `Press 1 to power the autocannon in high slot 1, click the dummy's lock card, then click slot 1 to assign.`,
    zone: tutorialRegionZone("gunnery"),
    beaconColor: 0xff8866,
    nav: { trackId: "spoke-gunnery", label: "Gunnery Bay", targetX: TUTORIAL_GUNNERY_CENTER.x, targetY: TUTORIAL_GUNNERY_CENTER.y },
    onEnter(ctx) {
      const step = findStep("gunnery");
      ctx.snapshot.dummyCount = step ? countAliveTargetDummiesInZone(step.zone, ctx.player) : 0;
    },
    isComplete(ctx) {
      const step = findStep("gunnery");
      if (!step) return false;
      if (ctx.player.kills > 0 || hasBypassedScan(ctx.player)) return true;
      if (!ctx.inZone(step.zone)) return false;
      const startCount = ctx.snapshot.dummyCount as number ?? 0;
      return (startCount > 0 && countAliveTargetDummiesInZone(step.zone, ctx.player) < startCount);
    },
  },
  {
    id: "scan-signature",
    title: "Signal Trace",
    objective: () =>
      `Open the system map (${tutorialKey("map")}), aim at the southeast beacon sector, and Pulse to resolve the training signature`,
    hint: () =>
      `${tutorialKey("map")} opens the map — power your survey scanner in low slot 1 (hotkey 4), click near the beacon to aim the scan cone, then press Scan on the toolbar`,
    zone: tutorialRegionZone("scan-signature"),
    beaconColor: 0x6fd3ff,
    onEnter() {
      resetTutorialTrainingSite();
    },
    isComplete(ctx) {
      return isTrainingSiteResolved(ctx.player)
        || hasBypassedBreach(ctx.player);
    },
  },
  {
    id: "fly-signature",
    title: "Datacore Approach",
    objective: "Follow the guide lane to the resolved training signature",
    hint: "The cross marker shows where the datacore waits — fly the lit corridor to reach it",
    zone: tutorialRegionZone("fly-signature"),
    beaconColor: 0x6fd3ff,
    nav: {
      trackId: "spoke-signature",
      label: "Signal Trace",
      targetX: TUTORIAL_TRAINING_SITE_X,
      targetY: TUTORIAL_TRAINING_SITE_Y,
    },
    onEnter(ctx) {
      initTrackProgress(ctx, "spoke-signature");
    },
    isComplete(ctx) {
      const step = findStep("fly-signature");
      if (!step) return false;
      return isZoneStepComplete(ctx, step.zone)
        || hasBypassedBreach(ctx.player);
    },
  },
  {
    id: "breach-signature",
    title: "Breach Datacore",
    objective: () =>
      `Breach the training datacore (${tutorialKey("dock")} at the marker or from the overview)`,
    hint: () =>
      `Get close to the signature marker and press ${tutorialKey("dock")} to begin the breach sequence`,
    zone: tutorialRegionZone("breach-signature"),
    beaconColor: 0x6fd3ff,
    isComplete(ctx) {
      return isTrainingSiteComplete(ctx.player)
        || ctx.player.sysIdx !== 0;
    },
  },
  {
    id: "fly-gate",
    title: "Stargate Spoke",
    objective: "Follow the final guide lane to the Novus Prime stargate at the sector rim",
    hint: "The stargate awakens when you begin this leg — fly the spoke and pass through the boost gates.",
    zone: tutorialRegionZone("fly-gate"),
    beaconColor: 0xffffff,
    nav: { trackId: "spoke-gate", label: "Stargate", targetX: TUTORIAL_GATE.x, targetY: TUTORIAL_GATE.y },
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
    title: "Stargate Graduation",
    objective: () => `Warp to Novus Prime — fly to the stargate and press ${tutorialKey("dock")} to jump`,
    hint: () =>
      `Enter the stargate's interact range and press ${tutorialKey("dock")} to warp out. Press Graduate once you arrive in Novus Prime.`,
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
