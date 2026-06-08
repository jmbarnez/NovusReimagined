import type { Player } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { dst } from "../utils/math.js";
import type { HiddenSite, SignatureContact, SignatureStrengthLabel } from "../types/world.js";
import { angularDistanceDeg, bearingToPointDeg, isInScanCone, normalizeAngleDeg } from "./geometry.js";

const DETECT_PROGRESS = 0.16;
const MOVEMENT_TRIANG_BONUS_DIST = 400;

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

export function createContact(site: HiddenSite, distance: number, p: Player): SignatureContact {
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

export function sitePassesScanCone(site: HiddenSite, scanAngle: number, coneDeg: number, p: Player): boolean {
  if (site.isTutorialSite) return true;
  const bearing = bearingToPointDeg(p.x, p.y, site.x, site.y);
  return isInScanCone(bearing, scanAngle, coneDeg);
}

export function incrementPulseSamplesAtPulseStart(pulseRange: number, scanAngle: number, coneDeg: number, p: Player): void {
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
