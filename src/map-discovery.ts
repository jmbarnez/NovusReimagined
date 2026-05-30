import { type Player } from "./state.js";

import { PlayerAccess, getState } from "./state-access.js";
import { C } from "./config/index.js";
import { dst } from "./utils/math.js";
import { isInScanCone, bearingToPointDeg } from "./scanning.js";
import { populateSystem } from "./world-gen.js";
import { curSys } from "./utils/game.js";
import { TUTORIAL_LOCAL_REGIONS, TUTORIAL_SECTOR } from "./data/tutorial-layout.js";
import type { System } from "./types/world.js";

export type LocalRegionDef = {
  id: string;
  name: string;
  x: number;
  y: number;
  sectorIdx: number;
  radius?: number;
};

export function getLocalRegionsForSystem(sysIdx: number): LocalRegionDef[] {
  if (sysIdx === 0) {
    return TUTORIAL_LOCAL_REGIONS.map((reg) => ({
      id: reg.id,
      name: reg.name,
      x: reg.x,
      y: reg.y,
      sectorIdx: 0,
      radius: reg.r,
    }));
  }
  return (C.WORLD.CONCENTRIC.localRegions as LocalRegionDef[]).filter((reg) => reg.sectorIdx === sysIdx);
}

export function getConcentricSectorAt(x: number, y: number): number {
  let targetIdx = 1;
  let minDist = Infinity;
  for (const sec of C.WORLD.CONCENTRIC.sectors) {
    const d = Math.hypot(x - sec.x, y - sec.y);
    if (d < minDist) {
      minDist = d;
      targetIdx = sec.idx;
    }
  }
  return targetIdx;
}

export function canSetMapWaypointAt(x: number, y: number, p: Player): boolean {
  const sys = curSys(p);
  if (!sys) return false;
  if (sys.idx < 1) return true;
  return getConcentricSectorAt(x, y) === p.sysIdx;
}

export function isConcentricPlayer(p: Player): boolean {
  return (p?.sysIdx ?? 0) >= 1;
}

export function isSectorDiscovered(sectorIdx: number, p: Player): boolean {
  if (sectorIdx === 0) return p?.tutorial?.active === true || p?.sysIdx === 0;
  return p.discoveredConcentricSectors.includes(sectorIdx);
}

export function isLocalRegionDiscovered(regionId: string, p: Player): boolean {
  return p.discoveredLocalRegionIds.includes(regionId);
}

export function discoverSector(sectorIdx: number, p: Player): void {
  if (sectorIdx < 1 || sectorIdx > 4) return;
  if (isSectorDiscovered(sectorIdx, p)) return;
  PlayerAccess.addDiscoveredConcentricSector(sectorIdx, p);
  const sys = getState().GALAXY[sectorIdx];
  if (sys && !sys._ready) populateSystem(sys);
}

export function discoverLocalRegion(regionId: string, p: Player): void {
  if (isLocalRegionDiscovered(regionId, p)) return;
  PlayerAccess.addDiscoveredLocalRegion(regionId, p);
}

/** Pre-mark all tutorial zone regions as known (shown on map from the start). */
export function ensureTutorialRegionsDiscovered(p: Player): void {
  for (const reg of TUTORIAL_LOCAL_REGIONS) {
    discoverLocalRegion(reg.id, p);
  }
}

/** Ensure sector 1 is known when first entering the concentric world. */
export function ensureConcentricBootstrap(p: Player): void {
  if (!isConcentricPlayer(p)) return;
  if (p.discoveredConcentricSectors.length === 0) {
    discoverSector(1, p);
  }
}

/** Migrate / backfill discovery for saves already deep in concentric space. */
export function backfillDiscoveryFromPosition(p: Player): void {
  if (!isConcentricPlayer(p)) return;
  for (let i = 1; i <= p.sysIdx; i++) {
    discoverSector(i, p);
  }
}

export function systemsVisibleOnMap(sys: System, p: Player): System[] {
  if (sys.idx < 1) return [sys];
  return getState().GALAXY.filter((s) => s.idx >= 1 && isSectorDiscovered(s.idx, p));
}

export function computeDiscoveredMapBounds(sys: System, playerX: number, playerY: number, p: Player): {
  mnX: number;
  mnY: number;
  mxX: number;
  myY: number;
} {
  if (sys.idx < 1) {
    const margin = 2000;
    const r = TUTORIAL_SECTOR.radius + margin;
    return {
      mnX: TUTORIAL_SECTOR.x - r,
      mnY: TUTORIAL_SECTOR.y - r,
      mxX: TUTORIAL_SECTOR.x + r,
      myY: TUTORIAL_SECTOR.y + r,
    };
  }

  const discovered = systemsVisibleOnMap(sys, p);
  let mnX = playerX;
  let mnY = playerY;
  let mxX = playerX;
  let myY = playerY;

  for (const sec of C.WORLD.CONCENTRIC.sectors) {
    if (!isSectorDiscovered(sec.idx, p)) continue;
    mnX = Math.min(mnX, sec.x - sec.r);
    mnY = Math.min(mnY, sec.y - sec.r);
    mxX = Math.max(mxX, sec.x + sec.r);
    myY = Math.max(myY, sec.y + sec.r);
  }

  for (const sSys of discovered) {
    for (const a of sSys.asteroids) {
      mnX = Math.min(mnX, a.x);
      mnY = Math.min(mnY, a.y);
      mxX = Math.max(mxX, a.x);
      myY = Math.max(myY, a.y);
    }
    for (const site of sSys.hiddenSites || []) {
      if (site.state === "hidden" || site.state === "cleared") continue;
      mnX = Math.min(mnX, site.x);
      mnY = Math.min(mnY, site.y);
      mxX = Math.max(mxX, site.x);
      myY = Math.max(myY, site.y);
    }
  }

  const margin = 2000;
  return {
    mnX: mnX - margin,
    mnY: mnY - margin,
    mxX: mxX + margin,
    myY: myY + margin,
  };
}

function tickRegionsForList(regions: LocalRegionDef[], discoverRadius: number, p: Player): void {
  for (const reg of regions) {
    if (isLocalRegionDiscovered(reg.id, p)) continue;
    if (dst(p.x, p.y, reg.x, reg.y) <= discoverRadius) {
      discoverLocalRegion(reg.id, p);
    }
  }
}

export function tickLocalRegionDiscovery(p: Player): void {
  const sys = curSys(p);
  if (!sys) return;

  if (sys.idx === 0) {
    if (!p?.tutorial?.active) return;
    tickRegionsForList(getLocalRegionsForSystem(0), C.WORLD.MAP.localRegionDiscoverRadius, p);
    return;
  }

  if (!isConcentricPlayer(p)) return;
  const radius = C.WORLD.MAP.localRegionDiscoverRadius;
  for (const reg of C.WORLD.CONCENTRIC.localRegions as LocalRegionDef[]) {
    if (!isSectorDiscovered(reg.sectorIdx, p)) continue;
    if (isLocalRegionDiscovered(reg.id, p)) continue;
    if (dst(p.x, p.y, reg.x, reg.y) <= radius) {
      discoverLocalRegion(reg.id, p);
    }
  }
}

export function tryDiscoverLocalRegionsFromScan(
  pulseRange: number,
  scanAngleDeg: number,
  coneDeg: number,
  p: Player,
): void {
  const sys = curSys(p);
  if (!sys) return;

  const scanRadius = C.WORLD.MAP.localRegionScanRadius;
  const regions = sys.idx === 0
    ? (p?.tutorial?.active ? getLocalRegionsForSystem(0) : [])
    : (C.WORLD.CONCENTRIC.localRegions as LocalRegionDef[]);

  for (const reg of regions) {
    if (sys.idx >= 1 && !isSectorDiscovered(reg.sectorIdx, p)) continue;
    if (isLocalRegionDiscovered(reg.id, p)) continue;
    const distance = dst(p.x, p.y, reg.x, reg.y);
    if (distance > pulseRange + scanRadius) continue;
    const bearing = bearingToPointDeg(p.x, p.y, reg.x, reg.y);
    if (!isInScanCone(bearing, scanAngleDeg, coneDeg)) continue;
    if (distance <= pulseRange + scanRadius) {
      discoverLocalRegion(reg.id, p);
    }
  }
}
