import { Client, type Player } from "./state.js";
import { PlayerAccess, getState } from "./state-access.js";
import { emit } from "./events.js";
import { savePlayer } from "./player/player-data.js";
import { clearSimulationEntities } from "./utils/entities.js";
import { dst } from "./utils/math.js";
import { curSys } from "./utils/game.js";
import { GATE_RANGE, WARP_TIME } from "./constants.js";
import { clearSensorLocks } from "./targeting.js";
import { floatText } from "./utils/fx.js";
import { populateSystem } from "./world-gen.js";
import { app } from "./pixi.js";
import type { Station, Gate } from "./types/world.js";

async function ensureStationInterface(st: Station): Promise<void> {
  const { ensureStationUI, buildStationView, renderStationView } = await import("./ui/station/index.js");
  ensureStationUI();
  buildStationView(st);
  renderStationView();
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
  await openStationUi(st);
}

export function getDockableStation(p: Player = getState().player, stationId?: string | null): Station | null {
  const sys = curSys(p);
  if (!sys) return null;
  const stations = stationId
    ? sys.stations.filter((st) => st.id === stationId)
    : sys.stations;
  return stations.find((st) => !st.isProcessingHub && dst(p.x, p.y, st.x, st.y) < st.radius * 2) ?? null;
}

export function getWarpGateInRange(p: Player = getState().player, targetIdx?: number | null): Gate | null {
  const sys = curSys(p);
  if (!sys || (p.warpCooldown ?? 0) > 0) return null;
  return sys.gates.find((g) => (targetIdx == null || g.targetSysIdx === targetIdx) && dst(p.x, p.y, g.x, g.y) < g.radius + GATE_RANGE) ?? null;
}

export async function openStationUi(st: Station): Promise<void> {
  Client.stationOpen = true;
  Client.activeStation = st;
  Client.mouse.lmb = false;
  if (typeof document !== "undefined") {
    await ensureStationInterface(st);
  }
  if (typeof document !== "undefined") {
    const stationOverlay = document.getElementById("station-overlay");
    if (stationOverlay instanceof HTMLElement) stationOverlay.style.display = "flex";
    const hud = document.getElementById("hud-overlay");
    if (hud instanceof HTMLElement) hud.style.display = "none";
    const canvas = app?.canvas as HTMLCanvasElement | undefined;
    if (canvas instanceof HTMLElement) canvas.style.cursor = "default";
  }
  emit("station:open", { station: st });
  logDockEvent(`Docked at ${st.name}`, "system");
}

export function closeStationUi(): void {
  Client.stationOpen = false;
  Client.activeStation = null;
  Client.skillsOpen = false;
  if (typeof document !== "undefined") {
    const stationOverlay = document.getElementById("station-overlay");
    if (stationOverlay instanceof HTMLElement) stationOverlay.style.display = "none";
    const hud = document.getElementById("hud-overlay");
    if (hud instanceof HTMLElement) hud.style.display = "block";
    const canvas = app?.canvas as HTMLCanvasElement | undefined;
    if (canvas instanceof HTMLElement) canvas.style.cursor = "none";
  }
  emit("station:close");
}

export function closeStation() {
  closeStationUi();
}

export function undockStation() {
  closeStationUi();
}

export function warpTo(targetIdx: number, p: Player = getState().player) {
  PlayerAccess.setWarpCooldown(2.5, p);
  if (p === getState().player) {
    clearSimulationEntities();
    emit("simulation:clear");
  }
  const fromIdx = p.sysIdx;
  PlayerAccess.setSysIdx(targetIdx, p);
  if (p === getState().player) {
    populateSystem(getState().GALAXY[targetIdx]);
  }
  const gates = getState().GALAXY[targetIdx].gates;
  const back = gates?.find((g: Gate) => g.targetSysIdx === fromIdx) ?? gates?.[0];
  if (back) {
    const len = Math.hypot(back.x, back.y) || 1;
    const nx = back.x / len, ny = back.y / len;
    const exit = back.radius + GATE_RANGE + 240;
    PlayerAccess.updatePhysics({
      x: back.x + nx * exit + (Math.random() - 0.5) * 32,
      y: back.y + ny * exit + (Math.random() - 0.5) * 32,
    }, p);
  } else {
    console.warn(`[warp] system ${targetIdx} has no gates; spawning at origin`);
    PlayerAccess.updatePhysics({ x: 0, y: 0 }, p);
  }
  PlayerAccess.updatePhysics({ px: p.x, py: p.y, vx: 0, vy: 0 }, p);
  PlayerAccess.setInvincible(2.0, p);
  clearSensorLocks(p);
  if (p === getState().player) {
    floatText(p.x, p.y - 55, `▶ ${getState().GALAXY[targetIdx].name}`, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(`Warped to ${getState().GALAXY[targetIdx].name}  (SEC ${getState().GALAXY[targetIdx].security.toFixed(1)})`, "system");
    savePlayer();
  }
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

export function tryWarp(p: Player = getState().player, targetIdx?: number | null): boolean {
  const gate = getWarpGateInRange(p, targetIdx);
  if (!gate) return false;
  PlayerAccess.setWarpCooldown(WARP_TIME, p);
  PlayerAccess.setWarpTargetIdx(gate.targetSysIdx, p);
  if (p === getState().player) {
    floatText(p.x, p.y - 45, `WARP to ${getState().GALAXY[gate.targetSysIdx]?.name || "..."}`, "#66aaff");
    playWarpAudio("charge");
  }
  return true;
}

export function clearWarpPresentation(p: Player = getState().player) {
  PlayerAccess.setWarpCooldown(0, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
}

export function refreshDockedStation(stationId: string | null, p: Player = getState().player): Station | null {
  if (!stationId) return null;
  return getDockableStation(p, stationId);
}
