import { Client, type Player } from "../../state.js";
import { getState } from "../../state-access.js";
import { getThemeColors } from "../../data/settings.js";
import { shouldShowWarpGate } from "../../data/tutorial.js";
import { dst } from "../../utils/math.js";
import { getPassiveScanRangePx } from "../../targeting.js";
import { SHIPS } from "../../data/ships.js";
import { passiveContactOpacity } from "../../ui/map-survey.js";
import { systemsVisibleOnMap } from "../../world/map-discovery.js";
import type { System } from "../../types/system.js";
import { pixiMapState } from "./state.js";
import { rgbaToHex } from "./utils.js";
import { setMapLabel } from "./labels.js";

export function drawObjects(
  toMap: (wx: number, wy: number) => { x: number; y: number },
  scale: number,
  playerMapPos: { x: number; y: number },
  now: number,
  sys: System,
  player: Player,
): void {
  if (!pixiMapState.objectGfx) return;
  pixiMapState.objectGfx.clear();

  const theme = getThemeColors(Client.settings?.theme || "default");
  const passiveRange = getPassiveScanRangePx(SHIPS[player.shipId]);
  const inPassiveRange = (wx: number, wy: number) => dst(player.x, player.y, wx, wy) <= passiveRange;

  const activeAndConcentricSystems = systemsVisibleOnMap(sys, player);

  for (const sSys of activeAndConcentricSystems) {
    // Asteroids
    for (const a of sSys.asteroids) {
      if (a.depleted || a.hp <= 0 || !inPassiveRange(a.x, a.y)) continue;
      const p = toMap(a.x, a.y);
      const alpha = passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, a.radius * 2);
      if (alpha < 0.14) continue;
      pixiMapState.objectGfx.circle(p.x, p.y, Math.max(1.5, a.radius * scale));
      pixiMapState.objectGfx.fill({ color: rgbaToHex(theme.hull), alpha: Math.max(0.4, alpha) });
    }

    // Enemies (triangles)
    for (const e of sSys.enemies) {
      if (!e.alive || !inPassiveRange(e.x, e.y)) continue;
      const p = toMap(e.x, e.y);
      const alpha = passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, e.sigRadius ?? 30);
      if (alpha < 0.14) continue;
      const size = Math.max(4, (e.radius ?? 3) * scale || 4);
      const angle = e.angle ?? 0;

      pixiMapState.objectGfx.moveTo(p.x + Math.cos(angle) * size, p.y + Math.sin(angle) * size);
      pixiMapState.objectGfx.lineTo(p.x + Math.cos(angle + Math.PI + 0.5) * size * 0.7, p.y + Math.sin(angle + Math.PI + 0.5) * size * 0.7);
      pixiMapState.objectGfx.lineTo(p.x + Math.cos(angle + Math.PI - 0.5) * size * 0.7, p.y + Math.sin(angle + Math.PI - 0.5) * size * 0.7);
      pixiMapState.objectGfx.closePath();
      const color = e.faction === "neutral"
        ? 0x999999
        : e.faction === "player" || e.faction === "friendly"
          ? rgbaToHex(theme.shield)
          : rgbaToHex(theme.danger);
      pixiMapState.objectGfx.fill({ color, alpha: Math.max(0.5, alpha) });
    }

    // Gates (diamonds)
    for (const g of sSys.gates) {
      if (!shouldShowWarpGate(g as unknown as import("../../types/station.js").Gate, sSys.idx, getState().player)) continue;
      const alwaysShowTutorialGate = sSys.idx === 0 && player.sysIdx === 0;
      if (!alwaysShowTutorialGate && !inPassiveRange(g.x, g.y)) continue;
      const p = toMap(g.x, g.y);
      const alpha = alwaysShowTutorialGate
        ? 0.82
        : passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, g.radius * 2);
      if (alpha < 0.14) continue;
      const size = Math.max(5, g.radius * scale || 6);

      pixiMapState.objectGfx.moveTo(p.x, p.y - size);
      pixiMapState.objectGfx.lineTo(p.x + size, p.y);
      pixiMapState.objectGfx.lineTo(p.x, p.y + size);
      pixiMapState.objectGfx.lineTo(p.x - size, p.y);
      pixiMapState.objectGfx.closePath();
      pixiMapState.objectGfx.fill({ color: rgbaToHex(theme.shield), alpha: Math.max(0.5, alpha) });
    }

    // Stations (squares)
    for (const s of sSys.stations) {
      const isCurrentSys = sSys.idx === player.sysIdx;
      const inRange = inPassiveRange(s.x, s.y);
      let alpha = passiveContactOpacity(s.x, s.y, player.x, player.y, now, s.radius * 2);
      if (isCurrentSys) {
        alpha = Math.max(0.82, alpha);
      } else if (!inRange || alpha < 0.14) {
        continue;
      }
      const p = toMap(s.x, s.y);
      const size = Math.max(6, s.radius * scale || 8);

      pixiMapState.objectGfx.rect(p.x - size / 2, p.y - size / 2, size, size);
      pixiMapState.objectGfx.fill({ color: rgbaToHex(theme.positive), alpha: Math.max(0.5, alpha) });

      setMapLabel(`station:${sSys.idx}:${s.id}`, s.name, "bold", p.x, p.y + size + 10, alpha * 0.9, rgbaToHex(theme.positive));
    }

    // Planets (circles with optional rings)
    for (const planet of sSys.planets) {
      const isCurrentSys = sSys.idx === player.sysIdx;
      const inRange = inPassiveRange(planet.x, planet.y);
      let alpha = passiveContactOpacity(planet.x, planet.y, player.x, player.y, now, planet.radius * 2);
      if (isCurrentSys) {
        alpha = Math.max(0.82, alpha);
      } else if (!inRange || alpha < 0.14) {
        continue;
      }
      const p = toMap(planet.x, planet.y);
      const size = Math.max(5, planet.radius * scale);

      pixiMapState.objectGfx.circle(p.x, p.y, size);
      pixiMapState.objectGfx.fill({ color: rgbaToHex(theme.shield), alpha: Math.max(0.5, alpha) });

      if (planet.hasRing) {
        pixiMapState.objectGfx.ellipse(p.x, p.y, size * 1.85, size * 0.72);
        pixiMapState.objectGfx.stroke({ color: rgbaToHex(theme.accent), width: 1, alpha: alpha * 0.55 });
      }
    }
  }
}
