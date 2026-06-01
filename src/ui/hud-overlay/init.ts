import "../styles/hud-base.css";
import "../styles/hud-sys-info.css";
import "../styles/hud-status-bars.css";
import "../styles/hud-misc.css";
import "../styles/hud-pickup-toasts.css";
import "../styles/hud-logs.css";
import "../styles/map-overlay.css";
import "../styles/bridge.css";
import { getState } from "../../state-access.js";
import { sfxConfirm } from "../../audio/procedural.js";
import { initMissionsPanel } from "../hud-missions.js";
import { t } from "../../utils/i18n.js";
import { on } from "../../events.js";
import { hudState } from "../hud/state.js";
import { updateHudOverviewPanel, updateHudOverviewPanelHeaders, initOverviewResizers } from "../hud/overview.js";
import { hideTurretCtxMenu } from "../hud/turret-menu.js";
import { hideEnemyCtxMenu } from "../hud/enemy-menu.js";
import { flushPendingLogEntries, logEvent, registerLogSink } from "../hud/logs.js";
import { showXpEarned } from "../hud/xp.js";
import { flashSlotFire } from "../hud/slots.js";
import { showPickupToast } from "../hud/pickup-toasts.js";
import { registerFeedbackHandlers } from "../../feedback.js";
import { openDecryptionWindowForSite } from "../decryption.js";
import { initPanelPopouts, dockInPanel, buildDockHeaderHTML } from "../hud/panel-popout.js";
import { flushNetLogPending } from "../net-console.js";
import { resetHubWindowState } from "./hub-window.js";

let crossingTimer: ReturnType<typeof setTimeout> | null = null;
let unsubCrossing: (() => void) | null = null;
let ctxMenuDismissBound = false;

function shouldShowLegacyOnboard(): boolean {
  if (localStorage.getItem("novus-onboarded")) return false;
  if (getState().player?.tutorial?.active || getState().player?.tutorial?.completed) return false;
  return true;
}

function onCtxMenuDismiss(e: MouseEvent) {
  if (hudState.turretCtxMenu && !hudState.turretCtxMenu.contains(e.target as Node)) {
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

  const overlay = document.getElementById("hud-overlay");
  if (!overlay) return;

  overlay.innerHTML = `
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
      <div id="hud-log-panel">
        <div id="hud-log-header" class="hud-dock-header">${buildDockHeaderHTML(t("hud.commsLog"))}</div>
        <div id="hud-log-body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <div id="hud-log-entries"></div>
          <div id="hud-log-chat-input-row" class="hud-log-chat-input-row">
            <span class="hud-log-chat-prefix">${t("hud.chatPrefix")}</span>
            <input type="text" id="hud-log-chat-input" class="hud-log-chat-input" placeholder="${t("hud.chatPlaceholder")}" maxlength="128" autocomplete="off" />
            <button type="button" id="hud-log-chat-send" class="hud-log-chat-send">SEND</button>
          </div>
        </div>
      </div>
      <div id="hud-bottom-right">
        <div id="hud-status-bars"></div>
        <div id="hud-slots"></div>
      </div>
      <div id="hud-scanner-dock">
        <div id="hud-scanner-header" class="hud-dock-header">${buildDockHeaderHTML(t("hud.overview"))}</div>
        <div id="hud-scanner-body">
          <div id="hud-overview-panel">
            <div class="ov-wrap">
              <table class="ov-table">
                <thead><tr>
                  <th></th>
                  <th class="ov-sortable" data-sort="state"><span class="th-text">${t("hud.state")}</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="class"><span class="th-text">${t("hud.class")}</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="name"><span class="th-text">${t("common.name")}</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="dist"><span class="th-text">${t("hud.dist")}</span><div class="ov-resizer"></div></th>
                  <th><span class="th-text">${t("hud.sig")}</span><div class="ov-resizer"></div></th>
                  <th><span class="th-text">${t("bridge.overviewDv")}</span><div class="ov-resizer"></div></th>
                </tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${shouldShowLegacyOnboard() ? `
    <div id="hud-onboard">
      <div class="onboard-title">${t("hud.pilotQuickstart")}</div>
      <div class="onboard-line"><span class="onboard-k">${t("hud.rightClick")}</span></div>
      <div class="onboard-line"><span class="onboard-k">${t("hud.leftClick")}</span></div>
      <div class="onboard-line"><span class="onboard-k">${t("hud.clickLocked")}</span></div>
      <div class="onboard-line"><span class="onboard-k">${t("hud.hotkeys")}</span></div>
    </div>
    ` : ""}
  `;

  if (shouldShowLegacyOnboard()) {
    setTimeout(() => {
      const onboardEl = document.getElementById("hud-onboard");
      if (onboardEl && !onboardEl.classList.contains("fade-out")) {
        onboardEl.classList.add("fade-out");
        setTimeout(() => onboardEl.remove(), 1000);
        localStorage.setItem("novus-onboarded", "true");
      }
    }, 12000);
  }

  // Bind references
  hudState.root = overlay;
  hudState.sysName = overlay.querySelector("#hud-sys-name");
  hudState.secEl = overlay.querySelector("#hud-sec");
  hudState.lockRail = overlay.querySelector("#hud-lock-rail");
  hudState.dockPrompt = overlay.querySelector("#hud-dock-prompt");
  hudState.xpPopup = overlay.querySelector("#hud-xp-popup");
  hudState.logEntries = overlay.querySelector("#hud-log-entries");
  hudState.logPanel = overlay.querySelector("#hud-log-panel");
  registerLogSink(hudState.logEntries);
  flushPendingLogEntries();
  hudState.slotsContainer = overlay.querySelector("#hud-slots");
  hudState.minimapContainer = overlay.querySelector("#hud-minimap");
  initMissionsPanel(overlay.querySelector("#hud-missions") as HTMLElement);
  hudState.scannerDock = overlay.querySelector("#hud-scanner-dock");
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
    const g = document.createElement("div");
    g.className = "hud-bar-group";
    g.innerHTML = `
      <span class="hud-bar-label">${label}</span>
      <div class="hud-bar-track"><span class="hud-bar-fill ${cls}"></span></div>
    `;
    bars.appendChild(g);
    hudState.statusFills.push(g.querySelector(".hud-bar-fill") as HTMLElement);
  }

  // Overview panel - scanner dock always present
  hudState.ovPanel = overlay.querySelector("#hud-overview-panel");
  hudState.ovEntries = hudState.ovPanel!.querySelector("tbody");

  // Attach sort listeners
  const headers = hudState.ovPanel!.querySelectorAll("thead th[data-sort]");
  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const key = (th as HTMLElement).dataset.sort as "state" | "class" | "name" | "dist";
      if (hudState.ovSortKey === key) {
        hudState.ovSortDir = (hudState.ovSortDir * -1) as 1 | -1;
      } else {
        hudState.ovSortKey = key;
        hudState.ovSortDir = 1;
      }
      sfxConfirm();
      updateHudOverviewPanelHeaders();
      updateHudOverviewPanel();
    });
  });
  updateHudOverviewPanelHeaders();
  initOverviewResizers(hudState.ovPanel!);
  document.body.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("#hud-overview-panel .ov-decrypt");
    if (!btn) return;
    ev.stopPropagation();
    const siteId = btn.getAttribute("data-site-id");
    if (siteId) openDecryptionWindowForSite(siteId);
  });
  // Turret context menu
  if (!document.getElementById("turret-ctx-menu")) {
    hudState.turretCtxMenu = document.createElement("div");
    hudState.turretCtxMenu.id = "turret-ctx-menu";
    hudState.turretCtxMenu.style.display = "none";
    document.body.appendChild(hudState.turretCtxMenu);
  } else {
    hudState.turretCtxMenu = document.getElementById("turret-ctx-menu");
  }

  // Enemy context menu
  if (!document.getElementById("enemy-ctx-menu")) {
    hudState.enemyCtxMenu = document.createElement("div");
    hudState.enemyCtxMenu.id = "enemy-ctx-menu";
    hudState.enemyCtxMenu.style.display = "none";
    document.body.appendChild(hudState.enemyCtxMenu);
  } else {
    hudState.enemyCtxMenu = document.getElementById("enemy-ctx-menu");
  }

  // Global context menus click listener
  if (!ctxMenuDismissBound) {
    document.addEventListener("click", onCtxMenuDismiss);
    ctxMenuDismissBound = true;
  }

  // Crossing banner event registration
  if (unsubCrossing) unsubCrossing();
  unsubCrossing = on("sector:crossed", ({ toIdx }) => {
    const sys = getState().GALAXY[toIdx];
    if (!sys) return;

    const banner = document.getElementById("hud-crossing-banner");
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
    banner.classList.add(secClass);

    const secPercent = Math.round(sys.security * 100);
    banner.innerHTML = `
      <div class="crossing-label">${t("hud.enteringSector")}</div>
      <div class="crossing-name">${sys.name.toUpperCase()}</div>
      <div class="crossing-sec">${t("hud.securityLevel", { sec: sys.security.toFixed(1), pct: secPercent })}</div>
    `;

    banner.style.display = "flex";

    try {
      sfxConfirm();
    } catch (_e) {}

    if (crossingTimer) {
      clearTimeout(crossingTimer);
    }
    crossingTimer = setTimeout(() => {
      banner.style.display = "none";
    }, 4000);
  });

  initPanelPopouts();
  flushNetLogPending();
}

export function destroyHudOverlay() {
  if (ctxMenuDismissBound) {
    document.removeEventListener("click", onCtxMenuDismiss);
    ctxMenuDismissBound = false;
  }
  if (hudState.root) {
    hudState.root.innerHTML = "";
    hudState.root = null;
  }
  hudState.logEntries = null;
  hudState.logPanel = null;
  registerLogSink(null);
  if (unsubCrossing) {
    unsubCrossing();
    unsubCrossing = null;
  }
  resetHubWindowState();
  hudState.slotNodes.clear();
  hudState.rackSwitchNodes.clear();
  hudState.lockCards.clear();
  hudState.turretCtxMenu?.remove();
  hudState.enemyCtxMenu?.remove();
  if (hudState.logPopout) dockInPanel("event-log");
  if (hudState.scannerPopout) dockInPanel("scanner");
  hudState.logPopout = false;
  hudState.scannerPopout = false;
  hudState.turretCtxMenu = null;
  hudState.enemyCtxMenu = null;
  document.getElementById("hud-slot-tooltip")?.remove();
  document.querySelectorAll('[id^="hud-win-"]').forEach((el) => el.remove());
  document.getElementById("map-scanner-panel")?.remove();
}
