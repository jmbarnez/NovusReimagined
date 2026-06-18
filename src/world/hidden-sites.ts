import { mkRng, rf, ri } from "../utils/math.js";
import { SITE_TYPES, type SiteTypeDef } from "../data/site-types.js";
import {
  TUTORIAL_TRAINING_SITE_ID,
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
  TUTORIAL_TRAINING_SITE_TYPE,
} from "../data/tutorial-site.js";
import { TAU } from "../constants.js";
import { C } from "../config/index.js";

import { PlayerAccess, getState } from "../state-access.js";
import type { HiddenSite, System } from "../types/system.js";

const SECTOR_OUTER_RADIUS = C.WORLD.SECTOR.outerRadius;
const SECTOR_BELT_CENTER = C.WORLD.SECTOR.beltCenter;

function orbitSpeedFor(x: number, y: number, f: () => number, multiplier = 1): number {
  const r = Math.max(1, Math.hypot(x, y));
  const o = C.WORLD.ORBITS;
  const dir = f() < 0.5 ? -1 : 1;
  const radiusScale = Math.pow(o.referenceRadius / r, o.radiusExponent);
  return dir * o.angularSpeedBase * radiusScale * rf(f, o.jitterMin, o.jitterMax) * multiplier;
}

/** Reset cadet training site for replay during the signature tutorial step. */
export function resetTutorialTrainingSite() {
  const sys = getState().GALAXY[0];
  const site = sys?.hiddenSites?.find((entry) => entry.id === TUTORIAL_TRAINING_SITE_ID);
  if (!site) return;
  site.state = "hidden";
  if (!getState().player) return;
  PlayerAccess.setCompletedSiteIds(getState().player.completedSiteIds.filter((id) => id !== TUTORIAL_TRAINING_SITE_ID));
  PlayerAccess.setScannedSiteIds(getState().player.scannedSiteIds.filter((id) => id !== TUTORIAL_TRAINING_SITE_ID));
  PlayerAccess.removeDetectedSignature(TUTORIAL_TRAINING_SITE_ID);
}

function pickSiteCountByRing(ring: number): { min: number; max: number } {
  if (ring <= 0) return { min: 1, max: 2 };
  if (ring === 1) return { min: 2, max: 4 };
  if (ring === 2) return { min: 3, max: 5 };
  return { min: 4, max: 6 };
}

function availableSiteTypes(sys: System): SiteTypeDef[] {
  const danger = Math.max(0, 1 - sys.security);
  return SITE_TYPES.filter((site) => {
    if (sys.idx === 0) return site.family !== "relic";
    if (danger < 0.25) return site.threatLevel <= 2;
    if (danger < 0.55) return site.threatLevel <= 3;
    return true;
  });
}

function siteOrbitBand(family: SiteTypeDef["family"]): { lo: number; hi: number } {
  if (family === "resource") {
    return {
      lo: Math.max(900, SECTOR_BELT_CENTER.lo - 450),
      hi: Math.min(SECTOR_OUTER_RADIUS - 800, SECTOR_BELT_CENTER.hi + 550),
    };
  }
  if (family === "derelict") {
    return {
      lo: Math.max(SECTOR_BELT_CENTER.hi + 400, SECTOR_OUTER_RADIUS * 0.62),
      hi: SECTOR_OUTER_RADIUS * 0.82,
    };
  }
  return {
    lo: Math.max(SECTOR_BELT_CENTER.hi + 900, SECTOR_OUTER_RADIUS * 0.82),
    hi: SECTOR_OUTER_RADIUS - 260,
  };
}

export function buildTutorialHiddenSite(sys: System) {
  const siteType = TUTORIAL_TRAINING_SITE_TYPE;
  sys.hiddenSites = [{
    id: TUTORIAL_TRAINING_SITE_ID,
    systemId: sys.idx,
    family: siteType.family,
    name: siteType.name,
    x: TUTORIAL_TRAINING_SITE_X,
    y: TUTORIAL_TRAINING_SITE_Y,
    threatLevel: siteType.threatLevel,
    signatureStrength: siteType.signatureStrength,
    signatureSize: siteType.signatureSize,
    scanDifficulty: siteType.scanDifficulty,
    decryptDifficulty: siteType.decryptDifficulty ?? 0,
    state: "hidden",
    rewardSeed: 424242,
    hasEncryptedContent: siteType.hasEncryptedContent,
    siteTypeId: siteType.id,
    requiredSurveyLevel: siteType.requiredSurveyLevel ?? 0,
    isTutorialSite: true,
    orbitSpeed: 0,
  }];
  applyHiddenSitePersistence(sys);
}

function hiddenSiteFromType(
  sys: System,
  siteType: SiteTypeDef,
  id: string,
  x: number,
  y: number,
  f: () => number,
): HiddenSite {
  return {
    id,
    systemId: sys.idx,
    family: siteType.family,
    name: siteType.name,
    x,
    y,
    threatLevel: siteType.threatLevel,
    signatureStrength: siteType.signatureStrength,
    signatureSize: siteType.signatureSize,
    scanDifficulty: siteType.scanDifficulty,
    decryptDifficulty: siteType.decryptDifficulty ?? 0,
    state: "hidden",
    rewardSeed: ri(f, 1, 1_000_000),
    hasEncryptedContent: siteType.hasEncryptedContent,
    siteTypeId: siteType.id,
    requiredSurveyLevel: siteType.requiredSurveyLevel ?? 0,
    orbitSpeed: orbitSpeedFor(x, y, f, C.WORLD.ORBITS.siteMultiplier),
  };
}

function applyHiddenSitePersistence(sys: System) {
  if (!sys.hiddenSites) return;
  for (const site of sys.hiddenSites) {
    if (getState().player?.completedSiteIds?.includes(site.id)) {
      site.state = "cleared";
      continue;
    }
    if (getState().player?.scannedSiteIds?.includes(site.id)) {
      site.state = "resolved";
      continue;
    }
    if (getState().player?.detectedSignatures?.some((entry) => entry.siteId === site.id && entry.systemId === sys.idx)) {
      site.state = "detected";
    }
  }
}

export function seedHiddenSites(sys: System, f: () => number) {
  const pool = availableSiteTypes(sys);
  const countRange = pickSiteCountByRing(sys.ring);
  const count = ri(f, countRange.min, countRange.max);
  const sites: HiddenSite[] = [];
  const isConcentric = sys.idx >= 1;

  for (let i = 0; i < count; i++) {
    const siteType = pool[ri(f, 0, pool.length - 1)];
    const ang = rf(f, 0, TAU);
    let rad: number;
    let cx = 0;
    let cy = 0;
    if (isConcentric) {
      const secConfig = C.WORLD.CONCENTRIC.sectors.find((s) => s.idx === sys.idx);
      if (secConfig) {
        cx = secConfig.x;
        cy = secConfig.y;
        const pad = 400;
        rad = rf(f, pad, secConfig.r - pad);
      } else {
        rad = rf(f, 400, 5000);
      }
    } else {
      const band = siteOrbitBand(siteType.family);
      rad = rf(f, band.lo, band.hi);
    }
    const x = Math.round(cx + Math.cos(ang) * rad);
    const y = Math.round(cy + Math.sin(ang) * rad);
    sites.push(hiddenSiteFromType(sys, siteType, `site-${sys.id}-${i}`, x, y, f));
  }
  sys.hiddenSites = sites;
  applyHiddenSitePersistence(sys);
}
