import { Client, type Player } from "../state.js";
import { PlayerAccess, WorldAccess, getState } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { curSys } from "../utils/game.js";
import { dst, lerp } from "../utils/math.js";
import { C } from "../config/index.js";
import { tryDiscoverLocalRegionsFromScan } from "../world/map-discovery.js";
import { sfxBlip, sfxConfirm, sfxError } from "../audio/procedural.js";
import { logEvent } from "../feedback.js";
import { addSkillXp } from "../player/player-data.js";
import { levelForSkillXp } from "../data/skills.js";
import type { HiddenSite, SignatureClassification } from "../types/world.js";
import { isHeadlessServer } from "../physics/net-input.js";
import {
  applyProgressCap,
  bearingToPointDeg,
  lerpAngleDeg,
  normalizeAngleDeg,
} from "./geometry.js";
import {
  createContact,
  incrementPulseSamplesAtPulseStart,
  sitePassesScanCone,
} from "./contacts.js";
import {
  getActiveScannerIndex,
  getScanEnergyCost,
  getScanPulseRemainingMs,
  getScanRangePx,
} from "./core.js";

let surveyBlockedLogged = new Set<string>();
const SURVEY_BLOCKED_LOG_MAX = 500;
const BASE_SCAN_RATE = 0.32;

export function startScanPulse(
  p: Player,
  opts?: { angleDeg?: number; allowWithoutMapOpen?: boolean; silent?: boolean },
): { started: boolean; reason?: string } {
  if (!opts?.allowWithoutMapOpen && p === getState().player && !isHeadlessServer() && (!Client.showMap || !Client.showSystemMap)) {
    return { started: false, reason: "Open system map (M) to aim and scan." };
  }
  if (!p.mapScannerActive) {
    return { started: false, reason: "Enable scanner power on the map panel." };
  }
  const sys = curSys(p);
  if (!sys) return { started: false, reason: "No active system." };
  if (getScanPulseRemainingMs(Date.now(), p) > 0) return { started: false, reason: "Scanner already cycling." };

  if (getActiveScannerIndex(p) === -1) {
    if (p === getState().player) sfxError();
    return { started: false, reason: "A Survey Scanner must be fitted in a low slot and powered ON to perform scans." };
  }

  const stats = getStats(p);
  const coneDeg = p.scannerConeDeg;
  const pulseRange = getScanRangePx(p);
  const energyCost = getScanEnergyCost(coneDeg);
  if (p.energy < energyCost) {
    if (p === getState().player && !opts?.silent) sfxError();
    return { started: false, reason: "Insufficient capacitor for scan." };
  }
  const scanAngle = normalizeAngleDeg(opts?.angleDeg ?? p.scannerAngle);
  incrementPulseSamplesAtPulseStart(pulseRange, scanAngle, coneDeg, p);
  tryDiscoverLocalRegionsFromScan(pulseRange, scanAngle, coneDeg, p);
  PlayerAccess.setEnergy(Math.max(0, p.energy - energyCost), p);
  PlayerAccess.setActiveScan({
    startedAt: Date.now(),
    pulseRange,
    strength: stats.scanStrength,
    angle: scanAngle,
    coneDeg,
  }, p);
  if (p === getState().player && !opts?.silent) {
    surveyBlockedLogged = new Set();
    sfxConfirm();
    logEvent(`Active scan launched.`, "system");
  }
  return { started: true };
}

function getSurveyLevel(p: Player): number {
  return levelForSkillXp(p.skillXp?.surveying ?? 0);
}

function meetsSurveyRequirement(site: HiddenSite, p: Player): boolean {
  const required = site.requiredSurveyLevel ?? 0;
  return getSurveyLevel(p) >= required;
}

function logSurveyBlocked(site: HiddenSite): void {
  if (surveyBlockedLogged.has(site.id)) return;
  if (surveyBlockedLogged.size >= SURVEY_BLOCKED_LOG_MAX) {
    const first = surveyBlockedLogged.values().next().value;
    if (first) surveyBlockedLogged.delete(first);
  }
  surveyBlockedLogged.add(site.id);
  const required = site.requiredSurveyLevel ?? 0;
  logEvent(`Surveying level ${required} required to resolve this signature.`, "system");
}

function getConeMultipliers(coneDeg: number): { resolveMult: number; detectFloor: number } {
  if (coneDeg <= 15) return { resolveMult: 5.0, detectFloor: 0.03 };
  if (coneDeg <= 45) return { resolveMult: 2.5, detectFloor: 0.06 };
  if (coneDeg <= 90) return { resolveMult: 1.4, detectFloor: 0.08 };
  return { resolveMult: 0.7, detectFloor: 0.12 };
}

export function updateScanning(dt: number, p: Player): void {
  const sys = curSys(p);
  if (!sys || !p.activeScan) return;
  if (getScanPulseRemainingMs(Date.now(), p) <= 0) {
    PlayerAccess.setActiveScan(null, p);
    return;
  }

  const stats = getStats(p);
  const active = p.activeScan;
  const coneScale = getConeMultipliers(active.coneDeg);
  const currentDetectFloor = coneScale.detectFloor;
  const nextContacts = [...p.detectedSignatures];
  let changed = false;

  for (const site of sys.hiddenSites || []) {
    if (site.state === "cleared" || p.completedSiteIds.includes(site.id)) continue;
    const distance = dst(p.x, p.y, site.x, site.y);
    if (distance > active.pulseRange) continue;
    if (!meetsSurveyRequirement(site, p)) {
      if (p === getState().player) logSurveyBlocked(site);
      continue;
    }
    if (!sitePassesScanCone(site, active.angle, active.coneDeg, p)) continue;

    const trueBearing = bearingToPointDeg(p.x, p.y, site.x, site.y);

    let contact = nextContacts.find((entry) => entry.siteId === site.id && entry.systemId === site.systemId);
    if (!contact) {
      const detectionStrength =
        active.strength / Math.max(0.55, site.scanDifficulty) *
        (site.signatureStrength / Math.max(0.6, site.signatureSize)) *
        Math.max(0.2, 1 - distance / Math.max(1, active.pulseRange));
      if (detectionStrength < currentDetectFloor) continue;
      contact = createContact(site, distance, p);
      nextContacts.push(contact);
      WorldAccess.setHiddenSiteState(site.systemId, site.id, "detected");
      changed = true;
      if (p === getState().player) {
        sfxBlip(940, 0.04);
        const detectMsg = site.isTutorialSite
          ? "Training signature detected."
          : `Signal contact detected: ${site.family} signature.`;
        logEvent(detectMsg, "system");
      }
    }
    if (!contact) continue;

    const distanceFactor = Math.max(0.2, 1 - distance / Math.max(1, active.pulseRange));
    const difficultyFactor = active.strength / Math.max(0.55, site.scanDifficulty);
    const signatureFactor = site.signatureStrength / Math.max(0.6, site.signatureSize);
    const pFactor = contact.parallaxFactor ?? 0;
    const triMult = pFactor > 0 ? (1.0 + 1.5 * pFactor) : 1.0;
    const progressGain = BASE_SCAN_RATE * dt * stats.scanResolveMult * difficultyFactor * signatureFactor * distanceFactor * triMult * coneScale.resolveMult;
    const confidenceGain = progressGain * 0.85;
    const driftAmount = site.family === "relic" ? 1.8 : site.family === "derelict" ? 0.9 : 0.25;
    const driftSpeed = site.family === "relic" ? 2.4 : site.family === "derelict" ? 1.5 : 0.8;

    const driftedBearing = normalizeAngleDeg(contact.bearingDeg + Math.sin((Date.now() / 1000) * driftSpeed + contact.driftPhase) * driftAmount * dt);
    const nextBearing = lerpAngleDeg(driftedBearing, trueBearing, Math.min(0.95, progressGain * 0.9));
    const nextError = Math.max(1.5, contact.bearingErrorDeg * (1 - Math.min(0.75, progressGain * 0.6)));
    const nextConfidence = Math.min(1, contact.confidence + confidenceGain);
    let nextProgress = Math.min(1, contact.progress + progressGain);
    nextProgress = applyProgressCap(nextProgress, contact.pulseSamples, site.isTutorialSite);
    const nextClass: SignatureClassification = nextProgress >= 0.55 ? site.family : "unknown";
    const nextState = nextProgress >= 0.85 ? "resolved" : nextProgress >= 0.55 ? "classified" : "detected";
    const estimatedDistance = lerp(distance * (1 + contact.bearingErrorDeg / 60), distance, Math.min(1, nextConfidence));

    if (Math.abs(nextProgress - contact.progress) > 1e-6) {
      contact.progress = nextProgress;
      contact.confidence = nextConfidence;
      contact.bearingDeg = nextBearing;
      contact.bearingErrorDeg = nextError;
      contact.classification = nextClass;
      contact.state = nextState;
      contact.lastKnownX = p.x + Math.cos(nextBearing * Math.PI / 180) * estimatedDistance;
      contact.lastKnownY = p.y + Math.sin(nextBearing * Math.PI / 180) * estimatedDistance;
      changed = true;
    }
    if (nextProgress >= 0.85 && site.state !== "resolved") {
      contact.state = "resolved";
      WorldAccess.setHiddenSiteState(site.systemId, site.id, "resolved");
      PlayerAccess.addScannedSiteId(site.id, p);
      addSkillXp("surveying", 14 + Math.round(site.scanDifficulty * 10), p);
      changed = true;
      if (p === getState().player) {
        sfxConfirm();
        logEvent(`Signature resolved: ${site.name}.`, "loot");
      }
    }
  }

  if (changed) {
    PlayerAccess.setDetectedSignatures(nextContacts, p);
  }
}
