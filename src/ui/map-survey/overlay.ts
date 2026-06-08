import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { Graphics } from "pixi.js";
import { getScanRangePx, isMapScannerEmitting } from "../../scanning/index.js";
import { radarSweepAngle } from "../../utils/radar-sweep.js";
import { worldToMapScreen } from "./transform.js";
import type { SystemMapTransform } from "./types.js";

export function drawMapSurveyOverlay(t: SystemMapTransform, now: number, g: Graphics) {
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const angleRad = Client.mapScannerAngleDeg * Math.PI / 180;
  const halfCone = (getState().player.scannerConeDeg / 2) * Math.PI / 180;
  const rayLen = getScanRangePx(getState().player) * t.scale;
  const sweep = radarSweepAngle(now);
  const emitting = isMapScannerEmitting(getState().player);

  if (emitting) {
    g.moveTo(pp.x, pp.y);
    g.arc(pp.x, pp.y, rayLen, sweep - 0.4, sweep);
    g.closePath();
    g.fill({ color: 0x6fd3ff, alpha: 0.10 });

    g.moveTo(pp.x, pp.y);
    g.lineTo(pp.x + Math.cos(sweep) * rayLen, pp.y + Math.sin(sweep) * rayLen);
    g.stroke({ color: 0x9ee8ff, width: 1.4, alpha: 0.55 });
  }

  // Cone fill
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rayLen, angleRad - halfCone, angleRad + halfCone);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: emitting ? 0.3 : 0.18 });

  // Cone centerline
  g.moveTo(pp.x, pp.y);
  g.lineTo(pp.x + Math.cos(angleRad) * rayLen, pp.y + Math.sin(angleRad) * rayLen);
  g.stroke({ color: emitting ? 0x9ee8ff : 0x6a9eb8, width: emitting ? 2 : 1.5, alpha: emitting ? 0.9 : 0.55 });

  // Range ring
  g.circle(pp.x, pp.y, rayLen);
  g.stroke({ color: 0x6fd3ff, width: 1, alpha: 0.22 });
}
