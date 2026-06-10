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
import { updateLockRail } from "../hud/targeting.js";
import { updateDockPrompt, updateHudOverviewPanel, updateHudOverviewPanelHeaders } from "../hud/overview.js";
import { updateShipPanelLive, buildShipPanelShell, attachShipPanelListeners } from "../hud/ship-panel/index.js";
import { updateTractorDial } from "../hud/tractor-dial.js";
import { updateHubTooltip } from "../hud/hub-tooltip.js";
import { isPanelPopout, popOutPanel, dockInPanel, togglePanelVisibility } from "../hud/panel-popout.js";
import { applyTheme } from "./theme.js";
import { updateMapOverlayDOM } from "./map-overlay.js";
import { maybeAutoCloseHubWindow } from "./hub-window.js";
import { C } from "../../config/index.js";
import { getElement, queryAll, createElement, setText, setHtml, setStyle, setPosition, getStyleProperty, toggleClass, remove } from "../dom-helpers.js";

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
  if (isPanelPopout("scanner")) {
    const win = getHudWindow("scanner-overview");
    if (win && getStyleProperty(win, "display") !== "none") {
      // window visible → off
      togglePanelVisibility("scanner");
      return;
    }
    // window hidden but still popped out → treat as off: dock back
    dockInPanel("scanner");
    if (hudState.scannerDock) setStyle(hudState.scannerDock, { display: "flex" });
    return;
  }
  const host = hudState.scannerDock;
  if (host && getStyleProperty(host, "display") !== "none") {
    // mounted → window
    popOutPanel("scanner");
    return;
  }
  // off → mounted
  dockInPanel("scanner");
  if (host) setStyle(host, { display: "flex" });
}

export function showCommsLogPanel() {
  if (isPanelPopout("event-log")) {
    const win = getHudWindow("event-log");
    if (win) setStyle(win, { display: "flex" });
    return;
  }
  if (hudState.logPanel) {
    setStyle(hudState.logPanel, { display: "flex" });
  }
}

export function toggleEventLogPanel() {
  if (isPanelPopout("event-log")) {
    const win = getHudWindow("event-log");
    if (win && getStyleProperty(win, "display") !== "none") {
      // window visible → off
      togglePanelVisibility("event-log");
      return;
    }
    // window hidden but still popped out → treat as off: dock back
    dockInPanel("event-log");
    if (hudState.logPanel) setStyle(hudState.logPanel, { display: "flex" });
    return;
  }
  if (hudState.logPanel && getStyleProperty(hudState.logPanel, "display") !== "none") {
    // mounted → window
    popOutPanel("event-log");
    return;
  }
  // off → mounted
  dockInPanel("event-log");
  if (hudState.logPanel) setStyle(hudState.logPanel, { display: "flex" });
}
