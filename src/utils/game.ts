import { G, Client } from "../state.js";
import { WorldAccess, MiningAccess, PlayerAccess } from "../state-access.js";
import { savePlayer } from "../player/player-data.js";
import { W, H } from "../canvas.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { clearSensorLocks } from "../targeting.js";
import { SHIPS } from "../data/ships.js";
import { populateSystem } from "../world-gen.js";
import { floatText, spawnExplosion, spawnShockwave } from "./fx.js";
import { sfxShipExplosion } from "../audio/procedural.js";
import { viewCenterX, viewCenterY } from "../render/viewport.js";
import { MODULE_HP_MAX, RACK_TYPES, LOCK_RAIL_H } from "../constants.js";
import { emit } from "../events.js";
import { clearSimulationEntities } from "./entities.js";
import type { System, Enemy, Asteroid } from "../types/world.js";

export function s2w(sx: number, sy: number): { x: number; y: number } {
  // Project from screen pixels to world coords using the playable-area centre
  // (matches the camera anchor used by the renderer / mouseWorld in game-loop).
  return {
    x: G.P.x + (sx - viewCenterX(W())) / Client.zoom,
    y: G.P.y + (sy - viewCenterY(H())) / Client.zoom,
  };
}

export function topHudHeight(): number {
  return Array.isArray(G.P?.lockQueue) && G.P.lockQueue.length > 0 ? LOCK_RAIL_H : 0;
}

export function curSys(): System | null {
  const idx = G.P?.sysIdx ?? 0;
  return G.GALAXY[idx] || G.GALAXY[0] || null;
}

const _emptyEnemies: Enemy[] = [];
const _emptyAsteroids: Asteroid[] = [];

export function liveEnemies(): Enemy[] {
  const sys = curSys();
  if (!sys) return _emptyEnemies;
  if (sys._liveEnemies) return sys._liveEnemies;
  return sys.enemies.filter((e) => e.alive);
}

export function liveAsteroids(): Asteroid[] {
  const sys = curSys();
  if (!sys) return _emptyAsteroids;
  if (sys._liveAsteroids) return sys._liveAsteroids;
  return sys.asteroids.filter((a) => !a.depleted && a.hp > 0);
}

let _vMinX = 0, _vMaxX = 0, _vMinY = 0, _vMaxY = 0;

export function updateViewportBounds(Wc: number, Hc: number, zoom: number, camx: number, camy: number, margin = 200) {
  const viewCX = viewCenterX(Wc);
  const viewCY = viewCenterY(Hc);
  const leftW = viewCX / zoom + margin;
  const rightW = (Wc - viewCX) / zoom + margin;
  const topH = viewCY / zoom + margin;
  const bottomH = (Hc - viewCY) / zoom + margin;
  _vMinX = camx - leftW;
  _vMaxX = camx + rightW;
  _vMinY = camy - topH;
  _vMaxY = camy + bottomH;
}

export function isVisible(x: number, y: number, radius = 0): boolean {
  return x + radius >= _vMinX && x - radius <= _vMaxX && y + radius >= _vMinY && y - radius <= _vMaxY;
}

export function getViewportBounds() {
  return { minX: _vMinX, maxX: _vMaxX, minY: _vMinY, maxY: _vMaxY };
}

export function respawnPlayer() {
  Client.showMap = false;
  emit("ui:close-overlays");

  Client.mouse.lmb = false;
  WorldAccess.setWarpCooldown(0);
  WorldAccess.setWarpTargetIdx(-1);

  const penalty = Math.floor(G.P.credits * 0.1);
  G.P.credits -= penalty;

  const fit = G.P.fitting;
  const slotActive: Record<string, boolean[]> = { turret: [], high: [], med: [], low: [] };
  const moduleHp: Record<string, (number | null)[]> = { turret: [], high: [], med: [], low: [] };
  for (const rack of RACK_TYPES) {
    const n = fit[rack].length;
    slotActive[rack] = Array(n).fill(true);
    moduleHp[rack] = Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const uid = fit[rack][i];
      if (uid) {
        const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
        moduleHp[rack][i] = inst ? Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX) : MODULE_HP_MAX;
      }
    }
  }
  PlayerAccess.setSlotActiveAll(slotActive);
  PlayerAccess.setModuleHpAll(moduleHp);
  PlayerAccess.setTurretTargetsAll(Array(fit.turret.length).fill(null));
  PlayerAccess.setTurretCdsAll(Array(fit.turret.length).fill(0));
  PlayerAccess.setTurretPowerAll(Array(fit.turret.length).fill(false));
  PlayerAccess.setTurretPowerCdAll(Array(fit.turret.length).fill(0));
  PlayerAccess.setCombatBar({ pos: 0.5, dir: 1 });
  if (G.P.slotHeat) {
    PlayerAccess.setSlotHeatAll({
      turret: Array(fit.turret.length).fill(0),
      high: Array(fit.high.length).fill(0),
      med: Array(fit.med.length).fill(0),
      low: Array(fit.low.length).fill(0),
    });
  }
  invalidate();
  const st = getStats();

  const homeIdx = G.P.homeSysIdx ?? 0;
  PlayerAccess.setSysIdx(homeIdx);
  PlayerAccess.updatePhysics({ vx: 0, vy: 0, va: 0, angle: 0, prevAngle: 0 });
  PlayerAccess.setShield(st.maxShield);
  PlayerAccess.setHp(st.maxHp);
  PlayerAccess.setStructure(st.maxStructure);
  PlayerAccess.setMaxHp(st.maxHp);
  PlayerAccess.setMaxStructure(st.maxStructure);
  PlayerAccess.setMaxShield(st.maxShield);
  PlayerAccess.setEnergy(st.maxEnergy);
  PlayerAccess.setInvincible(3.0);
  PlayerAccess.setShieldHitGlow(0);
  PlayerAccess.setHullHitGlow(0);
  clearSensorLocks();
  MiningAccess.update({ active: false });
  clearSimulationEntities();
  emit("simulation:clear");
  emit("player:respawn", { homeIdx, penalty });

  populateSystem(G.GALAXY[homeIdx]);
  const homeSys = G.GALAXY[homeIdx];
  const homeSt = homeSys?.stations[0];
  if (homeSt) {
    const hubR = Math.hypot(homeSt.x, homeSt.y);
    // Default outward direction to (1,0) when station is at origin
    const ox = hubR > 0.5 ? homeSt.x / hubR : 1;
    const oy = hubR > 0.5 ? homeSt.y / hubR : 0;
    const pad = homeSt.radius + 240;
    PlayerAccess.updatePhysics({ x: homeSt.x + ox * pad, y: homeSt.y + oy * pad });
  } else {
    PlayerAccess.updatePhysics({ x: 0, y: 0 });
  }
  PlayerAccess.updatePhysics({ px: G.P.x, py: G.P.y });
  Client.camx = G.P.x;
  Client.camy = G.P.y;
  spawnExplosion(G.P.x, G.P.y, "#ff4444", 1.2);
  spawnShockwave(G.P.x, G.P.y, "#ff4444", 1.2);
  sfxShipExplosion(G.P.x, G.P.y, 1.2);
  floatText(G.P.x, G.P.y - 50, `SHIP DESTROYED — POD ESCAPED${penalty > 0 ? ` (-${penalty}¢)` : ""}`, "#ff4444");
  savePlayer();
}
