import { Client, type Player } from "../state.js";
import { emit } from "../events.js";
import { app } from "../pixi.js";
import type { Station } from "../types/world.js";
import { dst } from "../utils/math.js";
import { curSys } from "../utils/game.js";
import { getState } from "../state-access.js";

async function ensureStationInterface(st: Station): Promise<void> {
  const { ensureStationUI, buildStationView, renderStationView } = await import("../ui/station/index.js");
  ensureStationUI();
  buildStationView(st);
  renderStationView();
}

function logDockEvent(msg: string, type: string = "system"): void {
  if (typeof window === "undefined") return;
  void import("../ui/hud-overlay.js")
    .then((m) => m.logEvent(msg, type))
    .catch(() => {
      // Ignore UI logging failures in non-UI runtimes.
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

export function refreshDockedStation(stationId: string | null, p: Player = getState().player): Station | null {
  if (!stationId) return null;
  return getDockableStation(p, stationId);
}
