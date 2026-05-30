import { Client, type Player } from "./state.js";
import { PlayerAccess, getState } from "./state-access.js";
import { emit } from "./events.js";
import { savePlayer } from "./player/player-data.js";
import { clearSimulationEntities } from "./utils/entities.js";
import { dst } from "./utils/math.js";
import { curSys } from "./utils/game.js";
import { GATE_RANGE, WARP_TIME } from "./constants.js";
import { clearSensorLocks } from "./targeting.js";
import { getStats } from "./player/player-stats.js";
import { floatText } from "./utils/fx.js";
import { checkDeliveryContracts } from "./data/missions.js";
import { populateSystem } from "./world-gen.js";
import type { Station, Gate } from "./types/world.js";

async function ensureStationInterface(st: Station): Promise<void> {
  const { ensureStationUI, buildStationUI } = await import("./ui/station.js");
  ensureStationUI();
  buildStationUI(st);
}

function logDockEvent(msg: string, type: string = "system"): void {
  if (typeof window === "undefined") return;
  void import("./ui/hud-overlay.js")
    .then((m) => m.logEvent(msg, type))
    .catch(() => {
      // Ignore UI logging failures in non-UI runtimes.
    });
}

function playWarpAudio(kind: "charge" | "jump"): void {
  if (typeof window === "undefined") return;
  void import("./audio/procedural.js")
    .then((m) => {
      if (kind === "charge") m.sfxWarpCharge();
      else m.sfxWarpJump();
    })
    .catch(() => {
      // Ignore audio init failures in headless runtimes.
    });
}

export async function dockAt(st: Station) {
  clearSensorLocks();
  Client.stationOpen = true;
  Client.activeStation = st;
  Client.mouse.lmb = false;
  if (typeof document !== "undefined") {
    await ensureStationInterface(st);
  }
  checkDeliveryContracts(st);
  if (typeof document !== "undefined") {
    const stationOverlay = document.getElementById("station-overlay");
    if (stationOverlay instanceof HTMLElement) stationOverlay.style.display = "flex";
    const hud = document.getElementById("hud-overlay");
    if (hud instanceof HTMLElement) hud.style.display = "none";
    const canvas = document.getElementById("c");
    if (canvas instanceof HTMLElement) canvas.style.cursor = "default";
  }
  emit("station:open", { station: st });
  logDockEvent(`Docked at ${st.name}`, "system");
  savePlayer();
}

export function closeStation() {
  Client.stationOpen = false;
  Client.activeStation = null;
  Client.skillsOpen = false;
  if (typeof document !== "undefined") {
    const stationOverlay = document.getElementById("station-overlay");
    if (stationOverlay instanceof HTMLElement) stationOverlay.style.display = "none";
    const hud = document.getElementById("hud-overlay");
    if (hud instanceof HTMLElement) hud.style.display = "block";
    const canvas = document.getElementById("c");
    if (canvas instanceof HTMLElement) canvas.style.cursor = "none";
  }
  PlayerAccess.setInvincible(1.5);
  PlayerAccess.setShieldCd(0);
  const st = getStats();
  if (st.maxShield > 0) PlayerAccess.setShield(st.maxShield);
  if (getState().player.turretPower) PlayerAccess.setTurretPowerAll(Array(getState().player.turretPower.length).fill(false));
  if (getState().player.turretPowerCd) PlayerAccess.setTurretPowerCdAll(Array(getState().player.turretPowerCd.length).fill(0));
  emit("station:close");
}

export function undockStation() {
  for (const rack of ["high", "med", "low"] as const) {
    const arr = getState().player.slotActive?.[rack];
    if (arr) {
      for (let i = 0; i < arr.length; i++) PlayerAccess.setSlotActive(rack, i, false);
    }
  }
  closeStation();
  savePlayer();
}



export function warpTo(targetIdx: number, _p: Player = getState().player) {
  PlayerAccess.setWarpCooldown(2.5);
  clearSimulationEntities();
  emit("simulation:clear");
  const fromIdx = getState().player.sysIdx;
  PlayerAccess.setSysIdx(targetIdx);
  populateSystem(getState().GALAXY[targetIdx]);
  const gates = getState().GALAXY[targetIdx].gates;
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
  PlayerAccess.updatePhysics({ px: getState().player.x, py: getState().player.y, vx: 0, vy: 0 });
  PlayerAccess.setInvincible(2.0);
  clearSensorLocks();
  floatText(getState().player.x, getState().player.y - 55, `▶ ${getState().GALAXY[targetIdx].name}`, "#66aaff");
  playWarpAudio("jump");
  logDockEvent(`Warped to ${getState().GALAXY[targetIdx].name}  (SEC ${getState().GALAXY[targetIdx].security.toFixed(1)})`, "system");
  savePlayer();
}

export function updateWarp(dt: number) {
  if (getState().warpCooldown > 0) {
    PlayerAccess.setWarpCooldown(getState().warpCooldown - dt);
    if (getState().warpCooldown <= 0) {
      PlayerAccess.setWarpCooldown(0);
      if (getState().warpTargetIdx >= 0) warpTo(getState().warpTargetIdx);
      PlayerAccess.setWarpTargetIdx(-1);
    }
  }
}

export function tryWarp(_p: Player = getState().player): boolean {
  const sys = curSys();
  if (!sys || getState().warpCooldown > 0) return false;
  for (const g of sys.gates) {
    if (dst(getState().player.x, getState().player.y, g.x, g.y) < g.radius + GATE_RANGE) {
      PlayerAccess.setWarpCooldown(WARP_TIME);
      PlayerAccess.setWarpTargetIdx(g.targetSysIdx);
      floatText(getState().player.x, getState().player.y - 45, `WARP to ${getState().GALAXY[g.targetSysIdx]?.name || "..."}`, "#66aaff");
      playWarpAudio("charge");
      return true;
    }
  }
  return false;
}

export function clearWarpPresentation(p: Player = getState().player) {
  PlayerAccess.setWarpCooldown(0, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
}
