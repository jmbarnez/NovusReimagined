export {
  TRIANGULATION_PROGRESS_MULT,
  PROGRESS_CAP_UNTIL_TRIANG,
  normalizeAngleDeg,
  angularDistanceDeg,
  isInScanCone,
  bearingToPointDeg,
  applyProgressCap,
} from "./geometry.js";

export {
  getScanPulseRemainingMs,
  getActiveScannerIndex,
  getConeRangeMult,
  getScanEnergyCost,
  getScanRangePx,
  getMapScannerStrength01,
  getMapScannerDrainMult,
  getMapScannerDrainPerSec,
  getMapScannerSignatureMult,
  isMapScannerEmitting,
  getEffectiveSignatureRadius,
  mapScannerStrengthStepIndex,
  setMapScannerStrengthFromStep,
  updateMapScanner,
} from "./core.js";

export { startScanPulse, updateScanning } from "./survey.js";
