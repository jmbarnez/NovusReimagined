import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import type { Station } from "../../types/world.js";
import { curSys } from "../../utils/game.js";
import { getStats } from "../../player/player-stats.js";
import { SHIPS } from "../../data/ships.js";
import { updateBridgeOverview } from "../bridge.js";
import { updateMissionsPanel } from "../hud-missions.js";
import { attachInventoryListeners } from "../inventory/index.js";
import { renderSkillsContent, initSkillsInteractions } from "../skills.js";
import { toggleHudWindow, isOpen, getHudWindow } from "../hud/windows.js";
import { updateMapSurveyUi } from "../map-survey.js";
import { hudState } from "../hud/state.js";
import { updateSlots } from "../hud/slots.js";
import { updateLockRail } from "../hud/targeting.js";
import { updateDockPrompt, updateHudOverviewPanel, updateHudOverviewPanelHeaders } from "../hud/overview.js";
import { updateShipPanelLive, buildShipPanelShell, attachShipPanelListeners } from "../hud/ship-panel/index.js";
import { updateTractorDial } from "../hud/tractor-dial.js";
import { updateHubTooltip } from "../hud/hub-tooltip.js";
import { isPanelPopout, togglePanelVisibility } from "../hud/panel-popout.js";
import { applyTheme } from "./theme.js";
import { updateMapOverlayDOM } from "./map-overlay.js";
import { maybeAutoCloseHubWindow } from "./hub-window.js";

function shouldShowLegacyOnboard(): boolean {
  if (localStorage.getItem("novus-onboarded")) return false;
  if (getState().player?.tutorial?.active || getState().player?.tutorial?.completed) return false;
  return true;
}

/* ── Update ── */
export function updateHudOverlay(Wc: number, Hc: number, now: number) {
  if (!hudState.root) return;

  // Dismiss legacy onboarding when pilot sets a waypoint/moves
  if (shouldShowLegacyOnboard() && Client.waypoint !== null) {
    const onboardEl = document.getElementById("hud-onboard");
    if (onboardEl && !onboardEl.classList.contains("fade-out")) {
      onboardEl.classList.add("fade-out");
      setTimeout(() => onboardEl.remove(), 1000);
      localStorage.setItem("novus-onboarded", "true");
    }
  }

  const sys = curSys();
  const st = getStats(getState().player);
  const ship = SHIPS[getState().player.shipId];

  applyTheme(Client.settings?.theme || "default", Client.settings?.fontFamily || "Orbitron");

  // Top bar text
  const sysName = sys?.name || "";
  if (hudState.sysName!.textContent !== sysName) {
    hudState.sysName!.textContent = sysName;
    hudState.sysName!.style.fontSize = sysName.length > 12 ? "7.5px" : "9px";
  }
  const sec = sys?.security ?? 0.5;
  const secText = `SEC ${sec.toFixed(1)}`;
  const secCls = sec >= 0.7 ? "high" : sec >= 0.4 ? "med" : "low";
  if (hudState.secEl!.textContent !== secText) hudState.secEl!.textContent = secText;
  if (hudState.secEl!.className !== secCls) hudState.secEl!.className = secCls;

  const barData = [
    [getState().player.shield, st.maxShield],
    [getState().player.hp, st.maxHp],
    [getState().player.structure, getState().player.maxStructure],
    [getState().player.energy, st.maxEnergy],
  ];
  for (let i = 0; i < 4; i++) {
    const [val, max] = barData[i];
    const w = `${Math.max(0, Math.min(1, val / Math.max(1, max))) * 100}%`;
    if (hudState.statusFills[i].style.width !== w) hudState.statusFills[i].style.width = w;
  }

  updateSlots(ship, st, now);
  updateLockRail(st, now);
  updateDockPrompt(sys);
  updateTractorDial();
  updateHubTooltip(sys);
  maybeAutoCloseHubWindow();
  if (Client.overviewOpen) updateBridgeOverview();
  updateHudOverviewPanel();
  updateMissionsPanel();
  updateShipPanelLive();
  for (const credEl of document.querySelectorAll(".inv-credits-value")) {
    const credText = `${Math.floor(getState().player.credits).toLocaleString()}¢`;
    if (credEl.textContent !== credText) credEl.textContent = credText;
  }

  // Update visual overlay for System Map (title, dynamic legend)
  const showMap = Client.showMap && Client.showSystemMap;
  const mapOverlayEl = document.getElementById("map-overlay");
  if (mapOverlayEl) {
    const isCurrentlyVisible = mapOverlayEl.style.display !== "none";
    if (showMap !== isCurrentlyVisible) {
      mapOverlayEl.style.display = showMap ? "block" : "none";
    }
    if (showMap && sys) {
      updateMapOverlayDOM(sys);
    }
  }

  // Ensure map survey toolbar visibility is updated as well
  updateMapSurveyUi();
}

/* ── Public helpers for window toggling (called from input.ts) ── */
export function toggleCargoWindow() {
  const shell = buildShipPanelShell();
  toggleHudWindow("cargo", "SHIP", shell);
  attachShipPanelListeners(shell);
  attachInventoryListeners();
}

export function toggleSkillsWindow() {
  const div = document.createElement("div");
  div.id = "bridge-pane-skills";
  div.className = "br-pane";
  div.style.height = "100%";
  div.style.overflow = "auto";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.innerHTML = renderSkillsContent();
  toggleHudWindow("skills", "Skills", div);
  initSkillsInteractions(div);
}

export function toggleScannerDock() {
  togglePanelVisibility("scanner");
}

export function showCommsLogPanel() {
  if (isPanelPopout("event-log")) {
    const win = getHudWindow("event-log");
    if (win) win.style.display = "flex";
    return;
  }
  if (hudState.logPanel) {
    hudState.logPanel.style.display = "flex";
  }
}

export function toggleEventLogPanel() {
  togglePanelVisibility("event-log");
}
