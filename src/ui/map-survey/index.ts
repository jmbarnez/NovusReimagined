export type { SystemMapTransform } from "./types.js";
export {
  resetMapPan,
  applyMapPanDrag,
  computeSystemMapTransform,
  worldToMapScreen,
  mapScreenToWorld,
} from "./transform.js";
export {
  aimScannerAtMapPoint,
  setMapWaypointFromScreen,
} from "./waypoint.js";
export {
  passiveContactOpacity,
  drawPassiveRadarOverlay,
  mapSignatureOpacity,
} from "./radar.js";
export { drawMapSurveyOverlay } from "./overlay.js";
export { updateMapSurveyUi, initMapSurvey } from "./ui.js";

// Re-export map-discovery helpers consumed by this module
export {
  systemsVisibleOnMap,
  isSectorDiscovered,
  isLocalRegionDiscovered,
} from "../../world/map-discovery.js";
export type { LocalRegionDef } from "../../world/map-discovery.js";
