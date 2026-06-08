import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { Graphics } from "pixi.js";
import { radarPingOpacity, radarSignatureDecayExponent, radarSweepAngle } from "../../utils/radar-sweep.js";
import { getPassiveScanRangePx } from "../../targeting.js";
import { SHIPS } from "../../data/ships.js";
import { isMapScannerEmitting, getMapScannerStrength01 } from "../../scanning/index.js";
import { worldToMapScreen } from "./transform.js";
import type { SystemMapTransform } from "./types.js";

/** Phosphor decay for hull passive radar (minimap + system map). */
export function passiveContactOpacity(
  blipMapX: number,
  blipMapY: number,
  originMapX: number,
  originMapY: number,
  now: number,
  signatureRadius?: number,
): number {
  return radarPingOpacity(
    blipMapX,
    blipMapY,
    originMapX,
    originMapY,
    radarSweepAngle(now),
    radarSignatureDecayExponent(signatureRadius),
  );
}

/** Draw hull passive radar sweep and range rings on the system map (always while map is open). */
export function drawPassiveRadarOverlay(t: SystemMapTransform, now: number, g: Graphics): void {
  const ship = SHIPS[getState().player.shipId];
  const rangeScreen = getPassiveScanRangePx(ship) * t.scale;
  const pp = worldToMapScreen(getState().player.x, getState().player.y, t);
  const sweep = radarSweepAngle(now);

  // Range rings
  g.stroke({ color: 0x64a0dc, width: 1, alpha: 0.22 });
  g.circle(pp.x, pp.y, rangeScreen * 0.35);
  g.stroke();
  g.circle(pp.x, pp.y, rangeScreen * 0.7);
  g.stroke();

  // Outer ring (dashed) — Pixi v8 doesn't expose setLineDash on Graphics, so draw
  // the ring as a single stroke at low alpha; the dashed look was a subtle hint
  // and is acceptable when solid.
  g.stroke({ color: 0x64a0dc, width: 1, alpha: 0.32 });
  g.circle(pp.x, pp.y, rangeScreen);
  g.stroke();

  // Sweep wedge — approximate the radial gradient by overlaying two alpha
  // fills (inner brighter, outer transparent).
  const sweepSpan = 0.38;
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rangeScreen, sweep - sweepSpan, sweep);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: 0.06 });
  g.moveTo(pp.x, pp.y);
  g.arc(pp.x, pp.y, rangeScreen * 0.5, sweep - sweepSpan, sweep);
  g.closePath();
  g.fill({ color: 0x6fd3ff, alpha: 0.05 });

  // Sweep leading edge
  g.moveTo(pp.x, pp.y);
  g.lineTo(pp.x + Math.cos(sweep) * rangeScreen, pp.y + Math.sin(sweep) * rangeScreen);
  g.stroke({ color: 0x9ee8ff, width: 1.4, alpha: 0.42 });
}

/** Survey signature blips: passive decay always; stronger when active scanner is emitting. */
export function mapSignatureOpacity(
  blipMapX: number,
  blipMapY: number,
  originMapX: number,
  originMapY: number,
  now: number,
  signatureRadius?: number,
): number {
  const ping = passiveContactOpacity(blipMapX, blipMapY, originMapX, originMapY, now, signatureRadius);
  if (!isMapScannerEmitting(getState().player)) return ping;
  return ping * (0.35 + 0.65 * getMapScannerStrength01(getState().player));
}
