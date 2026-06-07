import { _G, type Player } from "../../../state.js";
import { TUTORIAL_STEP_COUNT } from "../../../data/tutorial.js";

export const playerTutorialScanningAccess = {
  setTutorialStep(step: number, p: Player = _G.P) {
    p.tutorial.step = step;
  },

  setTutorialStepEnteredAt(at: number, p: Player = _G.P) {
    p.tutorial.stepEnteredAt = at;
  },

  setTutorialActive(active: boolean, p: Player = _G.P) {
    p.tutorial.active = active;
  },

  setTutorialComplete(p: Player = _G.P) {
    p.tutorial.active = false;
    p.tutorial.completed = true;
    p.tutorial.step = TUTORIAL_STEP_COUNT - 1;
  },

  setTutorialSkipped(p: Player = _G.P) {
    p.tutorial.skipped = true;
  },

  setTutorialState(state: Player["tutorial"], p: Player = _G.P) {
    p.tutorial = state;
  },

  setDetectedSignatures(signatures: Player["detectedSignatures"], p: Player = _G.P) {
    p.detectedSignatures = signatures;
  },

  addDetectedSignature(signature: Player["detectedSignatures"][number], p: Player = _G.P) {
    p.detectedSignatures.push(signature);
  },

  setScannedSiteIds(ids: Player["scannedSiteIds"], p: Player = _G.P) {
    p.scannedSiteIds = ids;
  },

  addScannedSiteId(id: string, p: Player = _G.P) {
    if (!p.scannedSiteIds.includes(id)) p.scannedSiteIds.push(id);
  },

  setCompletedSiteIds(ids: Player["completedSiteIds"], p: Player = _G.P) {
    p.completedSiteIds = ids;
  },

  addCompletedSiteId(id: string, p: Player = _G.P) {
    if (!p.completedSiteIds.includes(id)) p.completedSiteIds.push(id);
  },

  setActiveScan(activeScan: Player["activeScan"], p: Player = _G.P) {
    p.activeScan = activeScan;
  },

  setScannerAngle(angle: number, p: Player = _G.P) {
    p.scannerAngle = angle;
  },

  setWarpCooldown(value: number, p: Player = _G.P) {
    p.warpCooldown = value;
  },

  setWarpTargetIdx(value: number, p: Player = _G.P) {
    p.warpTargetIdx = value;
  },

  setScannerConeDeg(coneDeg: Player["scannerConeDeg"], p: Player = _G.P) {
    p.scannerConeDeg = coneDeg;
  },

  setMapScannerActive(active: boolean, p: Player = _G.P) {
    p.mapScannerActive = active;
  },

  setMapScannerStrength(strength: number, p: Player = _G.P) {
    p.mapScannerStrength = Math.max(0, Math.min(1, strength));
  },

  addDiscoveredConcentricSector(sectorIdx: number, p: Player = _G.P) {
    if (!p.discoveredConcentricSectors.includes(sectorIdx)) {
      p.discoveredConcentricSectors.push(sectorIdx);
    }
  },

  addDiscoveredLocalRegion(regionId: string, p: Player = _G.P) {
    if (!p.discoveredLocalRegionIds.includes(regionId)) {
      p.discoveredLocalRegionIds.push(regionId);
    }
  },

  updateDetectedSignature(siteId: string, patch: Partial<Player["detectedSignatures"][number]>, p: Player = _G.P) {
    const entry = p.detectedSignatures.find((contact) => contact.siteId === siteId && contact.systemId === p.sysIdx);
    if (entry) Object.assign(entry, patch);
  },

  removeDetectedSignature(siteId: string, p: Player = _G.P) {
    p.detectedSignatures = p.detectedSignatures.filter((contact) => !(contact.siteId === siteId && contact.systemId === p.sysIdx));
  },

  setTractorCarryKg(value: number, p: Player = _G.P) {
    p.tractorCarryKg = value;
  },

  setTractorTightness(value: number, p: Player = _G.P) {
    p.tractorTightness = value;
  },
};
