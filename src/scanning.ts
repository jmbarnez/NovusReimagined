import { Client, type Player } from "./state.js";
import { PlayerAccess, WorldAccess, getState } from "./state-access.js";
import { getStats } from "./player/player-stats.js";
import { curSys } from "./utils/game.js";
import { dst, lerp } from "./utils/math.js";
import { getSensorContactRangePx } from "./targeting.js";
import { C } from "./config/index.js";
import { tryDiscoverLocalRegionsFromScan } from "./map-discovery.js";
import { SHIPS } from "./data/ships.js";
import { sfxBlip, sfxConfirm, sfxError } from "./audio/procedural.js";
import { logEvent } from "./feedback.js";
import { addSkillXp } from "./player/player-data.js";
import { levelForSkillXp } from "./data/skills.js";
import { MODULES } from "./data/modules.js";
import { isSlotOnline } from "./utils/slot-power.js";
import { getInstance } from "./utils/items.js";
import type { HiddenSite, SignatureClassification, SignatureContact, SignatureStrengthLabel } from "./types/world.js";

const SCAN_PULSE_MS = 3500;
let surveyBlockedLogged = new Set<string>();
const BASE_SCAN_RATE = 0.32;
const DETECT_FLOOR = 0.08;
const DETECT_PROGRESS = 0.16;
export const TRIANGULATION_PROGRESS_MULT = 1.2;
export const PROGRESS_CAP_UNTIL_TRIANG = 0.55;
const MOVEMENT_TRIANG_BONUS_DIST = 400;

export function normalizeAngleDeg(deg: number): number {
  const out = deg % 360;
  return out < 0 ? out + 360 : out;
}

export function angularDistanceDeg(a: number, b: number): number {
  let diff = Math.abs(normalizeAngleDeg(a) - normalizeAngleDeg(b));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** True when site bearing lies inside the scan cone centered on scanAngleDeg. */
export function isInScanCone(siteBearingDeg: number, scanAngleDeg: number, coneDeg: number): boolean {
  return angularDistanceDeg(siteBearingDeg, scanAngleDeg) <= coneDeg / 2;
}

export function bearingToPointDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  return normalizeAngleDeg(Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI);
}

/** Clamp resolve progress until a second in-cone pulse (tutorial sites exempt). */
export function applyProgressCap(
  progress: number,
  pulseSamples: number,
  isTutorialSite?: boolean,
): number {
  if (isTutorialSite || pulseSamples >= 2) return progress;
  return Math.min(PROGRESS_CAP_UNTIL_TRIANG, progress);
}

function lerpAngleDeg(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return normalizeAngleDeg(a + diff * t);
}

function strengthLabel(site: HiddenSite): SignatureStrengthLabel {
  if (site.signatureStrength >= 0.82) return "strong";
  if (site.signatureStrength >= 0.62) return "medium";
  return "weak";
}

function familyNoise(site: HiddenSite): number {
  if (site.family === "relic") return 18;
  if (site.family === "derelict") return 12;
  return 8;
}

function createContact(site: HiddenSite, distance: number, p: Player): SignatureContact {
  const trueBearing = bearingToPointDeg(p.x, p.y, site.x, site.y);
  const noise = familyNoise(site);
  const driftSeed = (site.rewardSeed % 360) * Math.PI / 180;
  const drift = Math.sin(driftSeed) * noise;
  const bearingDeg = normalizeAngleDeg(trueBearing + drift);
  return {
    siteId: site.id,
    systemId: site.systemId,
    signalStrength: site.signatureStrength,
    progress: DETECT_PROGRESS,
    confidence: DETECT_PROGRESS,
    state: "detected",
    bearingDeg,
    bearingErrorDeg: noise,
    classification: "unknown",
    strengthLabel: strengthLabel(site),
    driftPhase: driftSeed,
    lastKnownX: p.x + Math.cos(bearingDeg * Math.PI / 180) * distance,
    lastKnownY: p.y + Math.sin(bearingDeg * Math.PI / 180) * distance,
    pulseSamples: 1,
    lastPulseX: p.x,
    lastPulseY: p.y,
    parallaxFactor: 0,
  };
}

function sitePassesScanCone(site: HiddenSite, scanAngle: number, coneDeg: number, p: Player): boolean {
  if (site.isTutorialSite) return true;
  const bearing = bearingToPointDeg(p.x, p.y, site.x, site.y);
  return isInScanCone(bearing, scanAngle, coneDeg);
}

function incrementPulseSamplesAtPulseStart(pulseRange: number, scanAngle: number, coneDeg: number, p: Player) {
  const sys = curSys(p);
  if (!sys) return;
  let changed = false;
  const next = p.detectedSignatures.map((contact) => {
    if (contact.systemId !== sys.idx) return contact;
    const site = sys.hiddenSites?.find((entry) => entry.id === contact.siteId);
    if (!site || site.state === "cleared" || p.completedSiteIds.includes(site.id)) return contact;
    const distance = dst(p.x, p.y, site.x, site.y);
    if (distance > pulseRange) return contact;
    if (!sitePassesScanCone(site, scanAngle, coneDeg, p)) return contact;
    changed = true;
    const lastX = contact.lastPulseX ?? p.x;
    const lastY = contact.lastPulseY ?? p.y;
    const moved = dst(lastX, lastY, p.x, p.y) > MOVEMENT_TRIANG_BONUS_DIST;
    
    let pFactor = 0;
    let nextError = contact.bearingErrorDeg;
    if (moved) {
      const oldBearing = bearingToPointDeg(lastX, lastY, site.x, site.y);
      const newBearing = bearingToPointDeg(p.x, p.y, site.x, site.y);
      const parallaxAngle = angularDistanceDeg(oldBearing, newBearing);
      pFactor = Math.abs(Math.sin(parallaxAngle * Math.PI / 180));
      // Reduce bearing error based on parallax factor: up to 35% reduction on cross-bearing
      nextError = Math.max(1.5, contact.bearingErrorDeg * (1 - 0.35 * pFactor));
    }
    
    return {
      ...contact,
      pulseSamples: contact.pulseSamples + 1,
      lastPulseX: p.x,
      lastPulseY: p.y,
      bearingErrorDeg: nextError,
      parallaxFactor: pFactor,
    };
  });
  if (changed) PlayerAccess.setDetectedSignatures(next, p);
}

export function getScanPulseRemainingMs(now: number = Date.now(), p: Player): number {
  const active = p.activeScan;
  if (!active) return 0;
  return Math.max(0, active.startedAt + SCAN_PULSE_MS - now);
}

export function getActiveScannerIndex(p: Player): number {
  const fitting = p.fitting;
  for (const rack of ["low", "med"] as const) {
    const slots = fitting[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = getInstance(uid, p);
      if (!inst || inst.durability <= 0) continue;
      const m = MODULES[inst.baseId];
      if (m?.isScanner && isSlotOnline(rack, i, p)) return i;
    }
  }
  return -1;
}

/** Tighter scan cone = longer reach (replaces legacy focus mode). */
export function getConeRangeMult(coneDeg: number): number {
  if (coneDeg <= 15) return 1.4;
  if (coneDeg <= 45) return 1.25;
  if (coneDeg <= 90) return 1.0;
  return 0.75;
}

/** Cap cost for an active scan burst, scaled by cone tightness. */
export function getScanEnergyCost(coneDeg: number): number {
  if (coneDeg <= 15) return 14;
  if (coneDeg <= 45) return 12;
  if (coneDeg <= 90) return 10;
  return 8;
}

export function getScanRangePx(p: Player): number {
  const ship = SHIPS[p.shipId];
  const stats = getStats(p);
  const baseRange = getSensorContactRangePx(ship) * stats.scanRange;
  const scaled = baseRange * getConeRangeMult(p.scannerConeDeg);
  if (p.sysIdx >= 1) {
    return Math.min(scaled, C.WORLD.MAP.surveyRangeCapPx);
  }
  return scaled;
}

export function getMapScannerStrength01(p: Player): number {
  return Math.max(0, Math.min(1, p.mapScannerStrength ?? 0.5));
}

/** Interpolated multiplier for cap drain from strength dial (0–1). */
export function getMapScannerDrainMult(p: Player): number {
  const t = getMapScannerStrength01(p);
  const { drainMin, drainMax } = C.SCANNING.MAP_STRENGTH;
  return drainMin + t * (drainMax - drainMin);
}

export function getMapScannerDrainPerSec(p: Player): number {
  return C.SCANNING.MAP_DRAIN.basePerSec * getMapScannerDrainMult(p);
}

/** Signature multiplier while map scanner is emitting. */
export function getMapScannerSignatureMult(p: Player): number {
  const t = getMapScannerStrength01(p);
  const { signatureMin, signatureMax } = C.SCANNING.MAP_STRENGTH;
  return signatureMin + t * (signatureMax - signatureMin);
}

export function isMapScannerEmitting(p: Player): boolean {
  return !!(Client.showMap && Client.showSystemMap && p.mapScannerActive);
}

export function getEffectiveSignatureRadius(p: Player): number {
  const ship = SHIPS[p.shipId];
  const base = ship?.signatureRadius ?? 45;
  if (!isMapScannerEmitting(p)) return base;
  return Math.round(base * getMapScannerSignatureMult(p));
}

/** Strength dial step index 0 … MAP_STRENGTH_STEPS - 1. */
export function mapScannerStrengthStepIndex(p: Player): number {
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  return Math.round(getMapScannerStrength01(p) * (steps - 1));
}

export function setMapScannerStrengthFromStep(step: number, p: Player): void {
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  const clamped = Math.max(0, Math.min(steps - 1, step));
  PlayerAccess.setMapScannerStrength(clamped / Math.max(1, steps - 1), p);
}

export function updateMapScanner(dt: number, p: Player): void {
  if (p === getState().player && (!Client.showMap || !Client.showSystemMap)) {
    if (p.mapScannerActive) PlayerAccess.setMapScannerActive(false, p);
    return;
  }
  if (!p.mapScannerActive) return;

  if (getActiveScannerIndex(p) === -1) {
    PlayerAccess.setMapScannerActive(false, p);
    return;
  }

  const drain = getMapScannerDrainPerSec(p) * dt;
  if (p.energy < drain) {
    PlayerAccess.setMapScannerActive(false, p);
    return;
  }
  PlayerAccess.setEnergy(p.energy - drain, p);
}

export function startScanPulse(p: Player): { started: boolean; reason?: string } {
  if (p === getState().player && (!Client.showMap || !Client.showSystemMap)) {
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
    if (p === getState().player) sfxError();
    return { started: false, reason: "Insufficient capacitor for scan." };
  }
  const scanAngle = p.scannerAngle;
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
  if (p === getState().player) {
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

function logSurveyBlocked(site: HiddenSite) {
  if (surveyBlockedLogged.has(site.id)) return;
  surveyBlockedLogged.add(site.id);
  const required = site.requiredSurveyLevel ?? 0;
  logEvent(`Surveying level ${required} required to resolve this signature.`, "system");
}

function getConeMultipliers(coneDeg: number): { resolveMult: number; detectFloor: number } {
  if (coneDeg <= 15) return { resolveMult: 5.0, detectFloor: 0.03 };
  if (coneDeg <= 45) return { resolveMult: 2.5, detectFloor: 0.06 };
  if (coneDeg <= 90) return { resolveMult: 1.4, detectFloor: 0.08 };
  return { resolveMult: 0.7, detectFloor: 0.12 }; // 180
}

export function updateScanning(dt: number, p: Player) {
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
      const detectionStrength = active.strength / Math.max(0.55, site.scanDifficulty)
        * (site.signatureStrength / Math.max(0.6, site.signatureSize))
        * Math.max(0.2, 1 - distance / Math.max(1, active.pulseRange));
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
