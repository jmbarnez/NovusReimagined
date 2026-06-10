import "../styles/hud-base.css";
import "../styles/hud-bottom-bar.css";
import "../styles/hud-minimap.css";
import "../styles/hud-sys-info.css";
import "../styles/hud-status-bars.css";
import "../styles/hud-misc.css";
import "../styles/hud-pickup-toasts.css";
import "../styles/hud-logs.css";
import "../styles/map-overlay.css";
import "../styles/bridge.css";
import { getElement, query, queryAll, createElement, append, remove, setHtml, setStyle, setText, toggleClass, onClick, onDocumentClick } from "../dom-helpers.js";
import { getState } from "../../state-access.js";
import { sfxConfirm } from "../../audio/procedural.js";
import { initMissionsPanel } from "../hud-missions.js";
import { t } from "../../utils/i18n.js";
import { on } from "../../events.js";
import { hudState } from "../hud/state.js";
import { updateHudOverviewPanel, updateHudOverviewPanelHeaders, buildOverviewPanel } from "../hud/overview.js";
import { hideTurretCtxMenu } from "../hud/turret-menu.js";
import { hideEnemyCtxMenu } from "../hud/enemy-menu.js";
import { flushPendingLogEntries, logEvent, registerLogSink } from "../hud/logs.js";
import { showXpEarned } from "../hud/xp.js";
import { flashSlotFire } from "../hud/slots.js";
import { showPickupToast } from "../hud/pickup-toasts.js";
import { registerFeedbackHandlers } from "../../feedback.js";
import { openDecryptionWindowForSite } from "../decryption.js";
import { flushNetLogPending } from "../net-console.js";
import { resetHubWindowState } from "./hub-window.js";

let crossingTimer: ReturnType<typeof setTimeout> | null = null;
let unsubCrossing: (() => void) | null = null;
let ctxMenuDismissBound = false;
let _removeDocumentClick: (() => void) | null = null;

function onCtxMenuDismiss(e: Event) {
  if (hudState.turretCtxMenu && !hudState.turretCtxMenu.contains((e as MouseEvent).target as Node)) {
    hideTurretCtxMenu();
  }
  if (hudState.enemyCtxMenu && !hudState.enemyCtxMenu.contains(e.target as Node)) {
    hideEnemyCtxMenu();
  }
}

/* ── Init ── */
export function initHudOverlay() {
  if (hudState.root) return;

  registerFeedbackHandlers({
    logEvent,
    flashSlotFire,
    showXpEarned,
    showPickupToast,
  });

  const overlay = getElement("hud-overlay");
  if (!overlay) return;

  setHtml(overlay, `
    <span id="hud-sys-name"></span>
    <span id="hud-sec"></span>
    <div id="hud-lock-rail"></div>
    <div id="hud-dock-prompt"></div>
    <div id="hud-xp-popup"></div>
    <div id="hud-pickup-container"></div>
    <div id="hud-crossing-banner" class="hud-crossing-banner" style="display: none;"></div>

    <div id="hud-minimap"></div>
    <div id="hud-missions"></div>

    <div id="map-overlay" class="map-overlay" style="display: none;"></div>

    <div id="hud-bottom">
      <div id="hud-bottom-right">
        <div id="hud-status-bars"></div>
        <div id="hud-slots"></div>
      </div>
    </div>
  `);

  // Build detached log panel (standalone window content)
  const logPanel = createElement("div", "");
  logPanel.id = "hud-log-panel";
  setHtml(logPanel, `
    <div id="hud-log-body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
      <div id="hud-log-entries"></div>
      <div id="hud-log-chat-input-row" class="hud-log-chat-input-row">
        <span class="hud-log-chat-prefix">${t("hud.chatPrefix")}</span>
        <input type="text" id="hud-log-chat-input" class="hud-log-chat-input" placeholder="${t("hud.chatPlaceholder")}" maxlength="128" autocomplete="off" />
        <button type="button" id="hud-log-chat-send" class="hud-log-chat-send">SEND</button>
      </div>
    </div>
  `);
  setStyle(logPanel, { display: "none", height: "100%" });
  append(document.body, logPanel);

  // Bind references
  hudState.root = overlay;
  hudState.sysName = overlay.querySelector("#hud-sys-name");
  hudState.secEl = overlay.querySelector("#hud-sec");
  hudState.lockRail = overlay.querySelector("#hud-lock-rail");
  hudState.dockPrompt = overlay.querySelector("#hud-dock-prompt");
  hudState.xpPopup = overlay.querySelector("#hud-xp-popup");
  hudState.logEntries = logPanel.querySelector("#hud-log-entries");
  hudState.logPanel = logPanel;
  registerLogSink(hudState.logEntries);
  flushPendingLogEntries();
  hudState.slotsContainer = overlay.querySelector("#hud-slots");
  hudState.minimapContainer = overlay.querySelector("#hud-minimap");
  initMissionsPanel(overlay.querySelector("#hud-missions") as HTMLElement);
  hudState.pickupContainer = overlay.querySelector("#hud-pickup-container");

  // Status bars injection
  const bars = overlay.querySelector("#hud-status-bars")!;
  const barDefs: [string, string][] = [
    [t("hud.shield"), "shield"],
    [t("hud.hull"), "hull"],
    [t("hud.structure"), "struct"],
    [t("hud.capacitor"), "cap"],
  ];
  hudState.statusFills = [];
  for (const [label, cls] of barDefs) {
    const g = createElement("div", "hud-bar-group");
    setHtml(g, `
      <span class="hud-bar-label">${label}</span>
      <div class="hud-bar-track"><span class="hud-bar-fill ${cls}"></span></div>
    `);
    append(bars, g);
    hudState.statusFills.push(g.querySelector(".hud-bar-fill") as HTMLElement);
  }
  const boostStatus = createElement("div", "hud-boost-status ready");
  boostStatus.id = "hud-boost-status";
  setText(boostStatus, t("hud.boostReady"));
  append(bars, boostStatus);
  hudState.boostStatus = boostStatus;

  // Overview panel — created detached, shown in a floating window on demand
  const ovPanel = buildOverviewPanel();
  hudState.ovPanel = ovPanel;
  hudState.ovEntries = ovPanel.querySelector("tbody");
  updateHudOverviewPanelHeaders();

  onClick(document.body, (ev) => {
    const btn = (ev.target as HTMLElement).closest("#hud-overview-panel .ov-decrypt");
    if (!btn) return;
    ev.stopPropagation();
    const siteId = btn.getAttribute("data-site-id");
    if (siteId) openDecryptionWindowForSite(siteId);
  });

  // Turret context menu
  if (!getElement("turret-ctx-menu")) {
    hudState.turretCtxMenu = createElement("div");
    hudState.turretCtxMenu.id = "turret-ctx-menu";
    setStyle(hudState.turretCtxMenu, { display: "none" });
    append(document.body, hudState.turretCtxMenu);
  } else {
    hudState.turretCtxMenu = getElement("turret-ctx-menu");
  }

  // Enemy context menu
  if (!getElement("enemy-ctx-menu")) {
    hudState.enemyCtxMenu = createElement("div");
    hudState.enemyCtxMenu.id = "enemy-ctx-menu";
    setStyle(hudState.enemyCtxMenu, { display: "none" });
    append(document.body, hudState.enemyCtxMenu);
  } else {
    hudState.enemyCtxMenu = getElement("enemy-ctx-menu");
  }

  // Global context menus click listener
  if (!ctxMenuDismissBound) {
    _removeDocumentClick = onDocumentClick(onCtxMenuDismiss);
    ctxMenuDismissBound = true;
  }

  // Crossing banner event registration
  if (unsubCrossing) unsubCrossing();
  unsubCrossing = on("sector:crossed", ({ toIdx }) => {
    const sys = getState().GALAXY[toIdx];
    if (!sys) return;

    const banner = getElement("hud-crossing-banner");
    if (!banner) return;

    banner.className = "hud-crossing-banner";

    let secClass = "null-sec";
    if (sys.security >= 0.7) {
      secClass = "high-sec";
    } else if (sys.security >= 0.4) {
      secClass = "mid-sec";
    } else if (sys.security >= 0.1) {
      secClass = "low-sec";
    }
    toggleClass(banner, secClass, true);

    const secPercent = Math.round(sys.security * 100);
    setHtml(banner, `
      <div class="crossing-label">${t("hud.enteringSector")}</div>
      <div class="crossing-name">${sys.name.toUpperCase()}</div>
      <div class="crossing-sec">${t("hud.securityLevel", { sec: sys.security.toFixed(1), pct: secPercent })}</div>
    `);

    setStyle(banner, { display: "flex" });

    try {
      sfxConfirm();
    } catch (_e) {}

    if (crossingTimer) {
      clearTimeout(crossingTimer);
    }
    crossingTimer = setTimeout(() => {
      setStyle(banner, { display: "none" });
    }, 4000);
  });

  flushNetLogPending();
}

export function destroyHudOverlay() {
  if (ctxMenuDismissBound && _removeDocumentClick) {
    _removeDocumentClick();
    _removeDocumentClick = null;
    ctxMenuDismissBound = false;
  }
  if (hudState.root) {
    setHtml(hudState.root, "");
    hudState.root = null;
  }
  if (hudState.logPanel) {
    remove(hudState.logPanel);
    hudState.logPanel = null;
  }
  hudState.logEntries = null;
  registerLogSink(null);
  if (unsubCrossing) {
    unsubCrossing();
    unsubCrossing = null;
  }
  resetHubWindowState();
  hudState.slotNodes.clear();
  hudState.rackSwitchNodes.clear();
  hudState.lockCards.clear();
  if (hudState.turretCtxMenu) remove(hudState.turretCtxMenu);
  if (hudState.enemyCtxMenu) remove(hudState.enemyCtxMenu);
  hudState.turretCtxMenu = null;
  hudState.enemyCtxMenu = null;
  const slotTooltip = getElement("hud-slot-tooltip");
  if (slotTooltip) remove(slotTooltip);
  for (const el of queryAll('[id^="hud-win-"]')) remove(el);
  const mapScannerPanel = getElement("map-scanner-panel");
  if (mapScannerPanel) remove(mapScannerPanel);
}
