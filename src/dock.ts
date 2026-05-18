import { G, Client } from "./state.js";
import { emit } from "./events.js";
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
export function dockAt(st: any) {
  closeBridge();
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
  G.P.invincible = 1.5;
  G.P.shieldCd = 0;
  const st = getStats();
  if (st.maxShield > 0) G.P.shield = st.maxShield;
  if (G.P.turretPower) G.P.turretPower.fill(false);
  if (G.P.turretPowerCd) G.P.turretPowerCd.fill(0);
  emit("station:close");
}

export function undockStation() {
  for (const rack of ["high", "med", "low"] as const) {
    if (G.P.slotActive?.[rack]) G.P.slotActive[rack].fill(false);
  }
  closeStation();
}

export function closeBridge() {
  // Keeping as an empty stub if used elsewhere
}

export function openBridge() {
  // Keeping as an empty stub if used elsewhere
}

export function toggleBridge() {
}

export function toggleBridgeInventory() {
}

export function toggleBridgeOverview() {
}

export function toggleSkills() {
}

export function closeSkills() {
}

export function renderBridgeUI() {
  // The bridge UI floating windows have been removed.
  // Content is now dynamically updated in the side panel via updateHudOverlay in hud-overlay.ts.
}

export function warpTo(targetIdx: number) {
  G.warpCooldown = 2.5;
  clearSimulationEntities();
  emit("simulation:clear");
  const fromIdx = G.P.sysIdx;
  G.P.sysIdx = targetIdx;
  populateSystem(G.GALAXY[targetIdx]);
  const gates = G.GALAXY[targetIdx].gates;
  const back = gates?.find((g: any) => g.targetSysIdx === fromIdx) ?? gates?.[0];
  if (back) {
    const len = Math.hypot(back.x, back.y) || 1;
    const nx = back.x / len, ny = back.y / len;
    const exit = back.radius + GATE_RANGE + 240;
    G.P.x = back.x + nx * exit + (Math.random() - 0.5) * 32;
    G.P.y = back.y + ny * exit + (Math.random() - 0.5) * 32;
  } else {
    console.warn(`[warp] system ${targetIdx} has no gates; spawning at origin`);
    G.P.x = 0; G.P.y = 0;
  }
  G.P.px = G.P.x; G.P.py = G.P.y;
  G.P.vx = G.P.vy = 0;
  G.P.invincible = 2.0;
  clearSensorLocks();
  floatText(G.P.x, G.P.y - 55, `▶ ${G.GALAXY[targetIdx].name}`, "#66aaff");
  sfxWarpJump();
  logEvent(`Warped to ${G.GALAXY[targetIdx].name}  (SEC ${G.GALAXY[targetIdx].security.toFixed(1)})`, "system");
}

export function updateWarp(dt: number) {
  if (G.warpCooldown > 0) {
    G.warpCooldown -= dt;
    if (G.warpCooldown <= 0) {
      G.warpCooldown = 0;
      if (G.warpTargetIdx >= 0) warpTo(G.warpTargetIdx);
      G.warpTargetIdx = -1;
    }
  }
}

export function tryWarp(): boolean {
  const sys = curSys();
  if (!sys || G.warpCooldown > 0) return false;
  for (const g of sys.gates) {
    if (dst(G.P.x, G.P.y, g.x, g.y) < g.radius + GATE_RANGE) {
      G.warpCooldown = WARP_TIME;
      G.warpTargetIdx = g.targetSysIdx;
      floatText(G.P.x, G.P.y - 45, `WARP to ${G.GALAXY[g.targetSysIdx]?.name || "..."}`, "#66aaff");
      sfxWarpCharge();
      return true;
    }
  }
  return false;
}
