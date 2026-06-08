import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { canSetMapWaypointAt } from "../../world/map-discovery.js";
import { bearingToPointDeg } from "../../scanning/index.js";
import { logEvent } from "../../feedback.js";
import { clearNav } from "../../state-access.js";
import { sfxBlip } from "../../audio/procedural.js";
import { t } from "../../utils/i18n.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialTrackById, snapToTrackCenterline } from "../../data/tutorial-layout.js";
import type { SystemMapTransform } from "./types.js";
import { mapScreenToWorld, computeSystemMapTransform } from "./transform.js";

export function aimScannerAtMapPoint(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const t = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!t) return false;
  const { x: wx, y: wy } = mapScreenToWorld(sx, sy, t);
  Client.mapScannerAngleDeg = bearingToPointDeg(getState().player.x, getState().player.y, wx, wy);
  return true;
}

export function setMapWaypointFromScreen(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const xform = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!xform) return false;
  if (Client.settings.movementControlMode !== "waypoint") {
    logEvent(t("map.survey.directMode"), "system");
    return false;
  }
  let { x: wx, y: wy } = mapScreenToWorld(sx, sy, xform);
  if (!canSetMapWaypointAt(wx, wy, getState().player)) {
    logEvent(t("map.survey.waypointSector"), "system");
    return false;
  }
  const step = getState().player?.tutorial?.active ? getCurrentTutorialStep(getState().player) : null;
  if (step?.nav) {
    const track = getTutorialTrackById(step.nav.trackId);
    if (track) {
      const snapped = snapToTrackCenterline(track, wx, wy);
      wx = snapped.x;
      wy = snapped.y;
    }
  }
  Client.waypoint = { x: wx, y: wy };
  clearNav();
  sfxBlip(520, 0.03);
  return true;
}
