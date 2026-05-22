import { G, Client } from "./state.js";
import { PlayerAccess, WorldAccess } from "./state-access.js";
import { emit } from "./events.js";
import { savePlayer } from "./player/player-data.js";
import { clearSimulationEntities } from "./utils/entities.js";
import { dst } from "./utils/math.js";
import { curSys } from "./utils/game.js";
import { DOCK_RANGE, GATE_RANGE, WARP_TIME } from "./constants.js";
import { clearSensorLocks } from "./targeting.js";
import { getStats } from "./player/player-stats.js";
import { floatText } from "./utils/fx.js";
import { ensureStationUI, buildStationUI } from "./ui/station.js";
import { checkDeliveryContracts } from "./data/missions.js";
import { renderBridgeOverviewHTML, renderBridgeCargoHTML, ensureBridgeUI, attachInventoryListeners, resetInventoryUI } from "./ui/bridge.js";
import { renderSkillsContent } from "./ui/skills.js";
import { populateSystem } from "./world-gen.js";
import { logEvent } from "./ui/hud-overlay.js";
import { sfxWarpCharge, sfxWarpJump } from "./audio/procedural.js";
import type { Station, Gate } from "./types/world.js";

export function dockAt(st: Station) {
  clearSensorLocks();
  Client.stationOpen = true;
  Client.activeStation = st;
  Client.mouse.lmb = false;
  ensureStationUI();
  buildStationUI(st);
  checkDeliveryContracts(st);
  (document.getElementById("station-overlay") as HTMLElement).style.display = "flex";
  const hud = document.getElementById("hud-overlay");
  if (hud) hud.style.display = "none";
  const canvas = document.getElementById("c");
  if (canvas) canvas.style.cursor = "default";
  emit("station:open", { station: st });
  logEvent(`Docked at ${st.name}`, "system");
  savePlayer();
}

export function closeStation() {
  Client.stationOpen = false;
  Client.activeStation = null;
  Client.skillsOpen = false;
  (document.getElementById("station-overlay") as HTMLElement).style.display = "none";
  const hud = document.getElementById("hud-overlay");
  if (hud) hud.style.display = "block";
  const canvas = document.getElementById("c");
  if (canvas) canvas.style.cursor = "none";
  PlayerAccess.setInvincible(1.5);
  PlayerAccess.setShieldCd(0);
  const st = getStats();
  if (st.maxShield > 0) PlayerAccess.setShield(st.maxShield);
  if (G.P.turretPower) PlayerAccess.setTurretPowerAll(Array(G.P.turretPower.length).fill(false));
  if (G.P.turretPowerCd) PlayerAccess.setTurretPowerCdAll(Array(G.P.turretPowerCd.length).fill(0));
  emit("station:close");
}

export function undockStation() {
  for (const rack of ["high", "med", "low"] as const) {
    const arr = G.P.slotActive?.[rack];
    if (arr) {
      for (let i = 0; i < arr.length; i++) PlayerAccess.setSlotActive(rack, i, false);
    }
  }
  closeStation();
  savePlayer();
}



export function warpTo(targetIdx: number) {
  WorldAccess.setWarpCooldown(2.5);
  clearSimulationEntities();
  emit("simulation:clear");
  const fromIdx = G.P.sysIdx;
  PlayerAccess.setSysIdx(targetIdx);
  populateSystem(G.GALAXY[targetIdx]);
  const gates = G.GALAXY[targetIdx].gates;
  const back = gates?.find((g: Gate) => g.targetSysIdx === fromIdx) ?? gates?.[0];
  if (back) {
    const len = Math.hypot(back.x, back.y) || 1;
    const nx = back.x / len, ny = back.y / len;
    const exit = back.radius + GATE_RANGE + 240;
    PlayerAccess.updatePhysics({ x: back.x + nx * exit + (Math.random() - 0.5) * 32, y: back.y + ny * exit + (Math.random() - 0.5) * 32 });
  } else {
    console.warn(`[warp] system ${targetIdx} has no gates; spawning at origin`);
    PlayerAccess.updatePhysics({ x: 0, y: 0 });
  }
  PlayerAccess.updatePhysics({ px: G.P.x, py: G.P.y, vx: 0, vy: 0 });
  PlayerAccess.setInvincible(2.0);
  clearSensorLocks();
  floatText(G.P.x, G.P.y - 55, `▶ ${G.GALAXY[targetIdx].name}`, "#66aaff");
  sfxWarpJump();
  logEvent(`Warped to ${G.GALAXY[targetIdx].name}  (SEC ${G.GALAXY[targetIdx].security.toFixed(1)})`, "system");
  savePlayer();
}

export function updateWarp(dt: number) {
  if (G.warpCooldown > 0) {
    WorldAccess.setWarpCooldown(G.warpCooldown - dt);
    if (G.warpCooldown <= 0) {
      WorldAccess.setWarpCooldown(0);
      if (G.warpTargetIdx >= 0) warpTo(G.warpTargetIdx);
      WorldAccess.setWarpTargetIdx(-1);
    }
  }
}

export function tryWarp(): boolean {
  const sys = curSys();
  if (!sys || G.warpCooldown > 0) return false;
  for (const g of sys.gates) {
    if (dst(G.P.x, G.P.y, g.x, g.y) < g.radius + GATE_RANGE) {
      WorldAccess.setWarpCooldown(WARP_TIME);
      WorldAccess.setWarpTargetIdx(g.targetSysIdx);
      floatText(G.P.x, G.P.y - 45, `WARP to ${G.GALAXY[g.targetSysIdx]?.name || "..."}`, "#66aaff");
      sfxWarpCharge();
      return true;
    }
  }
  return false;
}
