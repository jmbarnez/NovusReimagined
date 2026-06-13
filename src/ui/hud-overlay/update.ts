import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { curSys } from "../../utils/game.js";
import { getStats } from "../../player/player-stats.js";
import { SHIPS } from "../../data/ships.js";
import { t } from "../../utils/i18n.js";
import { updateBridgeOverview } from "../bridge.js";
import { updateMissionsPanel } from "../hud-missions.js";
import { attachInventoryListeners } from "../inventory/index.js";
import { hideInvHoverTip } from "../inventory/overlays.js";
import { renderSkillsContent, initSkillsInteractions } from "../skills.js";
import { toggleHudWindow, isOpen, getHudWindow, closeHudWindow, openHudWindow } from "../hud/windows.js";
import { updateMapSurveyUi } from "../map-survey.js";
import { hudState } from "../hud/state.js";
import { updateSlots } from "../hud/slots.js";
import { updateLockRail } from "../hud/targeting/index.js";
import { updateDockPrompt, updateHudOverviewPanel } from "../hud/overview.js";
import { updateShipPanelLive, buildShipPanelShell, attachShipPanelListeners } from "../hud/ship-panel/index.js";
import { updateTractorDial } from "../hud/tractor-dial.js";
import { updateHubTooltip } from "../hud/hub-tooltip.js";
import { applyTheme } from "./theme.js";
import { updateMapOverlayDOM } from "./map-overlay.js";
import { maybeAutoCloseHubWindow } from "./hub-window.js";
import { C } from "../../config/index.js";
import { getElement, queryAll, createElement, setText, setHtml, setStyle, setPosition, getStyleProperty, toggleClass, remove, append } from "../dom-helpers.js";

/* ── Update ── */
export function updateHudOverlay(Wc: number, Hc: number, now: number) {
  if (!hudState.root) return;

  const sys = curSys();
  const st = getStats(getState().player);
  const ship = SHIPS[getState().player.shipId];

  applyTheme(Client.settings?.theme || "default", Client.settings?.fontFamily || "Orbitron");

  // Top bar text
  const sysName = sys?.name || "";
  if (hudState.sysName!.textContent !== sysName) {
    setText(hudState.sysName!, sysName);
    setStyle(hudState.sysName!, { fontSize: sysName.length > 12 ? "7.5px" : "9px" });
  }
  const sec = sys?.security ?? 0.5;
  const secText = `${t("hud.sec")} ${sec.toFixed(1)}`;
  const secCls = sec >= 0.7 ? "high" : sec >= 0.4 ? "med" : "low";
  if (hudState.secEl!.textContent !== secText) setText(hudState.secEl!, secText);
  if (hudState.secEl!.className !== secCls) hudState.secEl!.className = secCls;

  // Show/hide shield bar based on whether ship has shields
  if (hudState.statusGroups[0]) {
    const hasShield = st.maxShield > 0;
    const shieldVisible = getStyleProperty(hudState.statusGroups[0], "display") !== "none";
    if (hasShield !== shieldVisible) {
      setStyle(hudState.statusGroups[0], { display: hasShield ? "flex" : "none" });
    }
  }

  const barData = [
    [getState().player.shield, st.maxShield],
    [getState().player.hp, st.maxHp],
    [getState().player.structure, getState().player.maxStructure],
    [getState().player.energy, st.maxEnergy],
  ];
  for (let i = 0; i < 4; i++) {
    const [val, max] = barData[i];
    const w = `${Math.max(0, Math.min(1, val / Math.max(1, max))) * 100}%`;
    if (getStyleProperty(hudState.statusFills[i], "width") !== w) setStyle(hudState.statusFills[i], { width: w });
  }
  if (hudState.boostStatus) {
    const p = getState().player;
    const lowCap = (p.energy ?? 0) < C.PHYSICS.SHIP.boostMinEnergyToStart;
    const cls = p.boostFx === true ? "boosting" : lowCap ? "lowcap" : "ready";
    const label = p.boostFx === true
      ? t("hud.boostActive")
      : lowCap
        ? t("hud.boostLowCap")
        : t("hud.boostReady");
    const className = `hud-boost-status ${cls}`;
    if (hudState.boostStatus.className !== className) hudState.boostStatus.className = className;
    if (hudState.boostStatus.textContent !== label) setText(hudState.boostStatus, label);
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
  for (const credEl of queryAll(".inv-credits-value")) {
    const credText = `${Math.floor(getState().player.credits).toLocaleString()}¢`;
    if (credEl.textContent !== credText) setText(credEl, credText);
  }

  // Update visual overlay for Map (title, dynamic legend, view toggle buttons)
  const showMap = Client.showMap;
  const mapOverlayEl = getElement("map-overlay");
  if (mapOverlayEl) {
    const isCurrentlyVisible = getStyleProperty(mapOverlayEl, "display") !== "none";
    if (showMap !== isCurrentlyVisible) {
      setStyle(mapOverlayEl, { display: showMap ? "block" : "none" });
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
  if (isOpen("cargo")) {
    closeHudWindow("cargo");
    hideInvHoverTip();
    return;
  }
  const shell = buildShipPanelShell();
  openHudWindow("cargo", "SHIP", shell, hideInvHoverTip);
  attachShipPanelListeners(shell);
  attachInventoryListeners();
}

export function toggleSkillsWindow() {
  const div = createElement("div", "br-pane");
  div.id = "bridge-pane-skills";
  setStyle(div, { height: "100%", overflow: "auto", display: "flex", flexDirection: "column" });
  setHtml(div, renderSkillsContent());
  toggleHudWindow("skills", "Skills", div);
  initSkillsInteractions(div);
}

export function toggleScannerDock() {
  const win = getHudWindow("scanner-overview");
  if (win && getStyleProperty(win, "display") !== "none") {
    closeHudWindow("scanner-overview");
    return;
  }
  if (!hudState.ovPanel) return;
  openHudWindow("scanner-overview", "LOCAL OVERVIEW", hudState.ovPanel);
  const w = getHudWindow("scanner-overview");
  if (w) {
    const ww = 360;
    const wh = 280;
    const left = Math.max(0, window.innerWidth - ww - 8);
    const top = Math.max(0, window.innerHeight - wh - 8);
    setStyle(w, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto", width: `${ww}px`, height: `${wh}px` });
  }
}

/** Show the comms log (used when new chat messages arrive). */
export function showCommsLogPanel() {
  if (isOpen("event-log")) return; // already floating and visible
  if (!hudState.logPanel || !hudState.logTab) return;
  const panelVisible = getStyleProperty(hudState.logPanel, "display") !== "none";
  if (panelVisible) return; // already docked and visible
  // Was minimized to tab (or hidden) — expand docked panel
  setStyle(hudState.logPanel, { display: "flex" });
  setStyle(hudState.logTab, { display: "none" });
}

/** Hotkey toggle: cycles docked-expanded → docked-tab → docked-expanded.
 *  If floating, closes the window and returns to docked-expanded. */
export function toggleEventLogPanel() {
  if (isOpen("event-log")) {
    closeHudWindow("event-log");
    return;
  }
  if (!hudState.logPanel || !hudState.logTab) return;
  const panelVisible = getStyleProperty(hudState.logPanel, "display") !== "none";
  if (panelVisible) {
    // expanded → minimize to tab
    setStyle(hudState.logPanel, { display: "none" });
    setStyle(hudState.logTab, { display: "flex" });
  } else {
    // tab (or hidden) → expand
    setStyle(hudState.logPanel, { display: "flex" });
    setStyle(hudState.logTab, { display: "none" });
  }
}

/** Pop the comms log out into a floating chrome window. */
export function popOutCommsLog() {
  if (!hudState.logBody || !hudState.logPanel || !hudState.logTab) return;
  if (isOpen("event-log")) return;

  // Hide docked UI while floating
  setStyle(hudState.logPanel, { display: "none" });
  setStyle(hudState.logTab, { display: "none" });

  openHudWindow("event-log", "COMMS LOG", hudState.logBody, () => {
    // Window closed: move body back to docked panel and show it
    if (hudState.logPanel && hudState.logBody) {
      append(hudState.logPanel, hudState.logBody);
      setStyle(hudState.logPanel, { display: "flex" });
    }
  });
}
