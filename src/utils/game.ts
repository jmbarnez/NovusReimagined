import { G, Client } from "../state.js";
import { W, H } from "../canvas.js";
import { LOCK_RAIL_H, AMMO_START_HYBRID, AMMO_START_MISSILE } from "../constants.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { defaultFitting } from "../player/player-data.js";
import { clearSensorLocks } from "../targeting.js";
import { SHIPS } from "../data/ships.js";
import { populateSystem } from "../world-gen.js";
import { floatText, spawnExplosion, spawnShockwave } from "./fx.js";
import { sfxShipExplosion } from "../audio/procedural.js";
import { viewCenterX, viewCenterY } from "../render/viewport.js";
import { MODULE_HP_MAX, RACK_TYPES } from "../constants.js";
import { emit } from "../events.js";
import { clearSimulationEntities } from "./entities.js";
import type { System, Enemy, Asteroid } from "../types/world.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { ModuleInstance } from "../types/moduleInstance.js";

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
  // UI-owned Client state (stationOpen / activeStation / bridgeOpen / overviewOpen / settingsOpen / skillsOpen)
  // is reset by the respective ui/* modules in response to "ui:close-overlays" per the AGENTS.md rule.
  Client.showMap = false;
  emit("ui:close-overlays");

  Client.mouse.lmb = false;
  G.warpCooldown = 0;
  G.warpTargetIdx = -1;

  const penalty = Math.floor(G.P.credits * 0.1);
  G.P.credits -= penalty;

  G.P.shipId = "scout";
  const fit = defaultFitting("scout");
  const startingInstances: ModuleInstance[] = [
    { uid: "respawn-tu-neutron", baseId: "tu-neutron", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "respawn-tu-strip", baseId: "tu-strip", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "respawn-me-ab1", baseId: "me-ab1", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
  ];
  fit.turret[0] = "respawn-tu-neutron";
  if (fit.turret.length > 1) fit.turret[1] = "respawn-tu-strip";
  fit.med[0] = "respawn-me-ab1";
  G.P.fitting = fit;
  G.P.moduleCargo = startingInstances;
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
  G.P.slotActive = slotActive;
  G.P.moduleHp = moduleHp;
  G.P.turretTargets = Array(fit.turret.length).fill(null);
  G.P.turretCds = Array(fit.turret.length).fill(0);
  G.P.turretPower = Array(fit.turret.length).fill(false);
  G.P.turretPowerCd = Array(fit.turret.length).fill(0);
  G.P.combatBar = { pos: 0.5, dir: 1 };
  if (G.P.slotHeat) {
    G.P.slotHeat.turret = Array(fit.turret.length).fill(0);
    G.P.slotHeat.high = Array(fit.high.length).fill(0);
    G.P.slotHeat.med = Array(fit.med.length).fill(0);
    G.P.slotHeat.low = Array(fit.low.length).fill(0);
  }
  G.P.ammo.hybrid = AMMO_START_HYBRID;
  G.P.ammo.missile = AMMO_START_MISSILE;
  invalidate();
  const st = getStats();

  const homeIdx = G.P.homeSysIdx ?? 0;
  G.P.sysIdx = homeIdx;
  G.P.vx = G.P.vy = G.P.va = 0;
  G.P.angle = 0;
  G.P.prevAngle = 0;
  G.P.shield = st.maxShield;
  G.P.hp = st.maxHp;
  G.P.structure = st.maxStructure;
  G.P.maxHp = st.maxHp;
  G.P.maxStructure = st.maxStructure;
  G.P.maxShield = st.maxShield;
  G.P.energy = st.maxEnergy;
  G.P.invincible = 3.0;
  G.P.shieldHitGlow = 0;
  G.P.hullHitGlow = 0;
  clearSensorLocks();
  G.miningLaser.active = false;
  clearSimulationEntities();
  emit("simulation:clear");
  emit("player:respawn", { homeIdx, penalty });

  populateSystem(G.GALAXY[homeIdx]);
  const homeSys = G.GALAXY[homeIdx];
  const homeSt = homeSys?.stations[0];
  if (homeSt) {
    const hubR = Math.hypot(homeSt.x, homeSt.y) || 1;
    const ox = homeSt.x / hubR;
    const oy = homeSt.y / hubR;
    const pad = homeSt.radius + 240;
    G.P.x = homeSt.x + ox * pad;
    G.P.y = homeSt.y + oy * pad;
  } else {
    G.P.x = 0;
    G.P.y = 0;
  }
  G.P.px = G.P.x;
  G.P.py = G.P.y;
  Client.camx = G.P.x;
  Client.camy = G.P.y;
  spawnExplosion(G.P.x, G.P.y, "#ff4444", 1.2);
  spawnShockwave(G.P.x, G.P.y, "#ff4444", 1.2);
  sfxShipExplosion(G.P.x, G.P.y, 1.2);
  floatText(G.P.x, G.P.y - 50, `SHIP DESTROYED — POD ESCAPED${penalty > 0 ? ` (-${penalty}¢)` : ""}`, "#ff4444");
  floatText(G.P.x, G.P.y - 80, `Ship lost — issued starter SPARROW D1`, "#ff8844");
}
