import { Client, type Player } from "../state.js";
import { WorldAccess, MiningAccess, PlayerAccess, getState } from "../state-access.js";
import { savePlayer } from "../player/player-data.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { clearSensorLocks } from "../targeting.js";
import { SHIPS } from "../data/ships.js";
import { populateSystem } from "../world-gen.js";
import { floatText, spawnExplosion, spawnShockwave } from "./fx.js";
import { sfxShipExplosion } from "../audio/procedural.js";
import { viewCenterX, viewCenterY } from "../render/viewport.js";
import { MODULE_HP_MAX, RACK_TYPES, LOCK_RAIL_H, HUD_SIDE_W, HUD_BOTTOM_H } from "../constants.js";
import { emit } from "../events.js";
import { clearSimulationEntities } from "./entities.js";
import { playerHardpointRack } from "./hardpoints.js";
import type { System, Enemy, Asteroid } from "../types/world.js";

function playableSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 1, height: 1 };
  const uiRight = Client.gameStarted ? HUD_SIDE_W : 0;
  const uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0;
  return {
    width: Math.max(1, window.innerWidth - uiRight),
    height: Math.max(1, window.innerHeight - uiBottom),
  };
}

export function s2w(sx: number, sy: number): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: getState().player.x, y: getState().player.y };
  }
  const { width, height } = playableSize();
  // Project from screen pixels to world coords using the playable-area centre
  // (matches the camera anchor used by the renderer / mouseWorld in game-loop).
  return {
    x: getState().player.x + (sx - viewCenterX(width)) / Client.zoom,
    y: getState().player.y + (sy - viewCenterY(height)) / Client.zoom,
  };
}

export function topHudHeight(): number {
  return Array.isArray(getState().player?.lockQueue) && getState().player.lockQueue.length > 0 ? LOCK_RAIL_H : 0;
}

export function curSys(p: Player = getState().player): System | null {
  const idx = p?.sysIdx ?? 0;
  return getState().GALAXY[idx] || getState().GALAXY[0] || null;
}

const _emptyEnemies: Enemy[] = [];
const _emptyAsteroids: Asteroid[] = [];

export function liveEnemies(p: Player = getState().player): Enemy[] {
  const sys = curSys(p);
  if (!sys) return _emptyEnemies;
  if (sys._liveEnemies) return sys._liveEnemies;
  return sys.enemies.filter((e) => e.alive);
}

export function liveAsteroids(p: Player = getState().player): Asteroid[] {
  const sys = curSys(p);
  if (!sys) return _emptyAsteroids;
  if (sys._liveAsteroids) return sys._liveAsteroids;
  return sys.asteroids.filter((a) => !a.depleted && a.hp > 0);
}

export function liveEnemiesInSys(sysIdx: number): Enemy[] {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return _emptyEnemies;
  if (sys._liveEnemies) return sys._liveEnemies;
  return sys.enemies.filter((e) => e.alive);
}

export function activePlayersInSys(sysIdx: number): Player[] {
  return allActivePlayers().filter((p) => p.sysIdx === sysIdx);
}

export function nearestPlayerInSys(sysIdx: number, x: number, y: number): Player | null {
  let best: Player | null = null;
  let bestD2 = Infinity;
  for (const p of activePlayersInSys(sysIdx)) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
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

export function respawnPlayer(p: Player = getState().player) {
  const isLocal = (p === getState().player);
  if (isLocal) {
    Client.showMap = false;
    emit("ui:close-overlays");
    Client.mouse.lmb = false;
    PlayerAccess.setWarpCooldown(0);
    PlayerAccess.setWarpTargetIdx(-1);
  }

  const penalty = Math.floor(p.credits * 0.1);
  p.credits -= penalty;

  const fit = p.fitting;
  const hardpointCount = fit[playerHardpointRack(p)]?.length ?? 0;
  const slotActive: Record<string, boolean[]> = { turret: [], high: [], med: [], low: [] };
  const moduleHp: Record<string, (number | null)[]> = { turret: [], high: [], med: [], low: [] };
  for (const rack of RACK_TYPES) {
    const n = fit[rack].length;
    slotActive[rack] = Array(n).fill(true);
    moduleHp[rack] = Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const uid = fit[rack][i];
      if (uid) {
        const inst = p.moduleCargo.find(inst => inst.uid === uid);
        moduleHp[rack][i] = inst ? Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX) : MODULE_HP_MAX;
      }
    }
  }

  if (isLocal) {
    PlayerAccess.setSlotActiveAll(slotActive);
    PlayerAccess.setModuleHpAll(moduleHp);
    PlayerAccess.setTurretTargetsAll(Array(hardpointCount).fill(null));
    PlayerAccess.setTurretCdsAll(Array(hardpointCount).fill(0));
    PlayerAccess.setTurretPowerAll(Array(hardpointCount).fill(false));
    PlayerAccess.setTurretPowerCdAll(Array(hardpointCount).fill(0));
    PlayerAccess.setCombatBar({ pos: 0.5, dir: 1 });
    if (p.slotHeat) {
      PlayerAccess.setSlotHeatAll({
        turret: Array(fit.turret.length).fill(0),
        high: Array(fit.high.length).fill(0),
        med: Array(fit.med.length).fill(0),
        low: Array(fit.low.length).fill(0),
      });
    }
  } else {
    p.slotActive = slotActive;
    p.moduleHp = moduleHp;
    p.turretTargets = Array(hardpointCount).fill(null);
    p.turretCds = Array(hardpointCount).fill(0);
    p.turretPower = Array(hardpointCount).fill(false);
    p.turretPowerCd = Array(hardpointCount).fill(0);
    p.combatBar = { pos: 0.5, dir: 1 };
    if (p.slotHeat) {
      p.slotHeat = {
        turret: Array(fit.turret.length).fill(0),
        high: Array(fit.high.length).fill(0),
        med: Array(fit.med.length).fill(0),
        low: Array(fit.low.length).fill(0),
      };
    }
  }

  invalidate(p);
  const st = getStats(p);

  const homeIdx = p.homeSysIdx ?? 0;
  if (isLocal) {
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
    clearSensorLocks(p);
    MiningAccess.update({ active: false });
    clearSimulationEntities();
    emit("simulation:clear");
    emit("player:respawn", { homeIdx, penalty });
  } else {
    p.sysIdx = homeIdx;
    p.vx = 0; p.vy = 0; p.va = 0; p.angle = 0; p.prevAngle = 0;
    p.shield = st.maxShield;
    p.hp = st.maxHp;
    p.structure = st.maxStructure;
    p.maxHp = st.maxHp;
    p.maxStructure = st.maxStructure;
    p.maxShield = st.maxShield;
    p.energy = st.maxEnergy;
    p.invincible = 3.0;
    p.shieldHitGlow = 0;
    p.hullHitGlow = 0;
    clearSensorLocks(p);
  }

  populateSystem(getState().GALAXY[homeIdx]);
  const homeSys = getState().GALAXY[homeIdx];
  const homeSt = homeSys?.stations[0];
  let spawnX = 0;
  let spawnY = 0;
  if (homeSt) {
    const hubR = Math.hypot(homeSt.x, homeSt.y);
    const ox = hubR > 0.5 ? homeSt.x / hubR : 1;
    const oy = hubR > 0.5 ? homeSt.y / hubR : 0;
    const pad = homeSt.radius + 240;
    spawnX = homeSt.x + ox * pad;
    spawnY = homeSt.y + oy * pad;
  }
  
  if (isLocal) {
    PlayerAccess.updatePhysics({ x: spawnX, y: spawnY });
    PlayerAccess.updatePhysics({ px: p.x, py: p.y });
    Client.camx = p.x;
    Client.camy = p.y;
    spawnExplosion(p.x, p.y, "#ff4444", 1.2);
    spawnShockwave(p.x, p.y, "#ff4444", 1.2);
    sfxShipExplosion(p.x, p.y, 1.2);
    floatText(p.x, p.y - 50, `SHIP DESTROYED — POD ESCAPED${penalty > 0 ? ` (-${penalty}¢)` : ""}`, "#ff4444");
    savePlayer();
  } else {
    p.x = spawnX;
    p.y = spawnY;
    p.px = spawnX;
    p.py = spawnY;
  }
}

export function allActivePlayers(): Player[] {
  const G = getState();
  if (!G.players) return [];
  return Array.from(G.players.values());
}

export function activeSystemIndices(): number[] {
  const players = allActivePlayers();
  const indices = new Set<number>();
  for (const p of players) {
    indices.add(p.sysIdx);
  }
  return Array.from(indices);
}
