import { Container, Graphics } from "pixi.js";
import { effectLayer, worldContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import type { System } from "../types/system.js";
import type { StationTurret } from "../types/station.js";
import { isVisible } from "../utils/game.js";

let turretLayer: Container | null = null;
const turretGfx = new Map<StationTurret, Graphics>();
const orbitGfx = new Map<string, Graphics>();

const TAU = Math.PI * 2;

function ensureLayer(): Container | null {
  const root = effectLayer ?? worldContainer;
  if (!root) return null;
  if (!turretLayer) {
    turretLayer = new Container();
    turretLayer.label = "station-turrets";
    root.addChild(turretLayer);
  } else if (!turretLayer.parent) {
    root.addChild(turretLayer);
  }
  return turretLayer;
}

function getGlow(g: Graphics, radius: number) {
  g.circle(0, 0, radius).fill({ color: 0x28648c, alpha: 0.25 });
}

function drawTurret(g: Graphics, t: StationTurret, face: number) {
  g.clear();
  g.position.set(t.x ?? 0, t.y ?? 0);
  g.rotation = face;

  // Glow base
  getGlow(g, 18);
  // Platform
  g.circle(0, 0, 9).fill({ color: 0x152838, alpha: 1 }).stroke({ color: 0x3a80a0, width: 1.5 });
  // Barrel
  g.rect(-2, -8, 4, 16).fill({ color: 0x5ab0d0 }).stroke({ color: 0xffffff, width: 0.8, alpha: 0.6 });
  // Muzzle tip
  g.circle(0, -10, 2).fill({ color: 0xa8e8ff, alpha: 0.8 });
}

export function syncPixiStationTurrets(now: number, sys: System): void {
  const layer = ensureLayer();
  if (!layer) return;

  const keepOrbits = new Set<string>();
  const keepTurrets = new Set<StationTurret>();

  for (const st of sys.stations ?? []) {
    if (!st.turrets?.length) continue;
    if (!isVisible(st.x, st.y, 300)) continue;

    // Orbit ring
    const orbitR = st.turrets[0]?.orbitRadius ?? (st.safeRadius ?? 600);
    const orbitId = st.id;
    keepOrbits.add(orbitId);
    let og = orbitGfx.get(orbitId);
    if (!og) {
      og = new Graphics();
      og.label = `turret-orbit-${orbitId}`;
      layer.addChild(og);
      orbitGfx.set(orbitId, og);
    }
    og.clear();
    og.circle(st.x, st.y, orbitR).stroke({ color: 0x82828c, width: 1, alpha: 0.12, alignment: 0 });

    for (const t of st.turrets) {
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      if (!isVisible(tx, ty, 40)) continue;
      keepTurrets.add(t);
      let gfx = turretGfx.get(t);
      if (!gfx) {
        gfx = new Graphics();
        gfx.label = "station-turret";
        layer.addChild(gfx);
        turretGfx.set(t, gfx);
      }
      drawTurret(gfx, t, t.faceAngle ?? t.angle ?? 0);
    }
  }

  // Cleanup
  for (const [id, og] of orbitGfx) {
    if (!keepOrbits.has(id)) {
      og.destroy();
      orbitGfx.delete(id);
    }
  }
  for (const [t, g] of turretGfx) {
    if (!keepTurrets.has(t)) {
      g.destroy();
      turretGfx.delete(t);
    }
  }
}

