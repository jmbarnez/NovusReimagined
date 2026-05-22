import "./styles/hud-base.css";
import "./styles/hud-sys-info.css";
import "./styles/hud-status-bars.css";
import "./styles/hud-misc.css";
import "./styles/hud-pickup-toasts.css";
import { G, Client } from "../state.js";
import { HUD_BOTTOM_H } from "../constants.js";
import { getTheme, getFontStack } from "../data/settings.js";
import { curSys } from "../utils/game.js";
import { getStats } from "../player/player-stats.js";
import { SHIPS } from "../data/ships.js";
import { requestSensorLock } from "../targeting.js";
import { updateBridgeOverview } from "./bridge.js";
import { sfxConfirm } from "../audio/procedural.js";
import { initMissionsPanel, updateMissionsPanel, getMissionsPanelEl } from "./hud-missions.js";
import { renderInventoryHTML, attachInventoryListeners } from "./inventory.js";
import { renderSkillsContent, initSkillsInteractions } from "./skills.js";
import { toggleHudWindow, closeHudWindow, openHudWindow, isOpen } from "./hud/windows.js";
import { collectHubOutput, hasHubOutput, fmtDuration } from "../hub.js";
import "./styles/bridge.css";

import { hudState } from "./hud/state.js";
import { updateSlots } from "./hud/slots.js";
import { updateLockRail } from "./hud/targeting.js";
import { updateDockPrompt, updateHudOverviewPanel, updateHudOverviewPanelHeaders, initOverviewResizers } from "./hud/overview.js";
import { hideTurretCtxMenu } from "./hud/turret-menu.js";
import { hideEnemyCtxMenu } from "./hud/enemy-menu.js";
import { buildShipPanelShell, attachShipPanelListeners, updateShipPanelLive } from "./hud/ship-panel.js";
import { updateTractorDial } from "./hud/tractor-dial.js";
import { updateHubTooltip } from "./hud/hub-tooltip.js";

// Re-export specific pieces that were previously in this file so other imports don't break.
export { logEvent } from "./hud/logs.js";
export { showXpEarned } from "./hud/xp.js";
export { flashSlotFire } from "./hud/slots.js";

/* ── Init ── */
export function initHudOverlay() {
  if (hudState.root) return;

  const overlay = document.getElementById("hud-overlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <span id="hud-sys-name"></span>
    <span id="hud-sec"></span>
    <div id="hud-lock-rail"></div>
    <div id="hud-dock-prompt"></div>
    <div id="hud-xp-popup"></div>
    <div id="hud-pickup-container"></div>

    <div id="hud-minimap"></div>

    <div id="hud-bottom">
      <div id="hud-log-panel">
        <div id="hud-log-header">EVENT LOG</div>
        <div id="hud-log-entries"></div>
      </div>
      <div id="hud-bottom-right">
        <div id="hud-status-bars"></div>
        <div id="hud-slots"></div>
      </div>
      <div id="hud-scanner-dock">
        <div id="hud-scanner-body">
          <div id="hud-overview-panel">
            <div class="ov-wrap">
              <table class="ov-table">
                <thead><tr>
                  <th style="width: 18px;"></th>
                  <th class="ov-sortable" data-sort="state" style="width: 44px;"><span class="th-text">State</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="class" style="width: 44px;"><span class="th-text">Class</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="name" style="width: 65px;"><span class="th-text">Name</span><div class="ov-resizer"></div></th>
                  <th class="ov-sortable" data-sort="dist" style="width: 50px;"><span class="th-text">Dist</span><div class="ov-resizer"></div></th>
                  <th style="width: 35px;"><span class="th-text">Act</span></th>
                </tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${localStorage.getItem("novus-onboarded") ? "" : `
    <div id="hud-onboard">
      <div class="onboard-title">PILOT QUICKSTART</div>
      <div class="onboard-line"><span class="onboard-k">Right-click</span> to move</div>
      <div class="onboard-line"><span class="onboard-k">Left-click</span> to lock target</div>
      <div class="onboard-line"><span class="onboard-k">1–0</span> to fire / activate modules</div>
    </div>
    `}

    <div id="hud-help">
      <div class="hh-sect">Flight</div>
      <div class="hh-line"><span class="hh-k">RMB</span> Set Waypoint</div>
      <div class="hh-line"><span class="hh-k">Mouse</span> Aim</div>
      <div class="hh-line"><span class="hh-k">Space</span> Brake</div>
      <div class="hh-line"><span class="hh-k">Wheel</span> Zoom</div>
      <div class="hh-sect">Combat</div>
      <div class="hh-line"><span class="hh-k">LMB</span> Lock</div>
      <div class="hh-line"><span class="hh-k">Shift+click</span> Turret → target</div>
      <div class="hh-line"><span class="hh-k">RMB slot</span> Turret menu</div>
      <div class="hh-sect">Modules</div>
      <div class="hh-line"><span class="hh-k">1-0</span> Activate</div>
      <div class="hh-line"><span class="hh-k">Click switch</span> Rack power</div>
      <div class="hh-sect">Windows</div>
      <div class="hh-line"><span class="hh-k">M</span> Galaxy map</div>
      <div class="hh-line"><span class="hh-k">F</span> Dock / Jump</div>
      <div class="hh-line"><span class="hh-k">Esc</span> Settings</div>
      <div class="hh-line"><span class="hh-k">\`</span> Performance</div>
    </div>
  `;

  if (!localStorage.getItem("novus-onboarded")) {
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
  hudState.slotsContainer = overlay.querySelector("#hud-slots");
  hudState.minimapContainer = overlay.querySelector("#hud-minimap");
  hudState.scannerDock = overlay.querySelector("#hud-scanner-dock");
  hudState.pickupContainer = overlay.querySelector("#hud-pickup-container");

  // Status bars injection
  const bars = overlay.querySelector("#hud-status-bars")!;
  const barDefs: [string, string][] = [
    ["SHLD", "shield"],
    ["HULL", "hull"],
    ["STRC", "struct"],
    ["CAP", "cap"],
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

  hudState.ovPanel!.addEventListener("mousedown", (ev) => {
    const btn = (ev.target as HTMLElement).closest(".ov-lock");
    if (!btn) return;
    ev.stopPropagation();
    sfxConfirm();
    const id = btn.getAttribute("data-lock-id");
    if (id) requestSensorLock(id);
  });

  // Missions panel (initialised but not mounted until opened as window)
  initMissionsPanel(overlay);

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
  document.addEventListener("click", (e) => {
    if (hudState.turretCtxMenu && !hudState.turretCtxMenu.contains(e.target as Node)) {
      hideTurretCtxMenu();
    }
    if (hudState.enemyCtxMenu && !hudState.enemyCtxMenu.contains(e.target as Node)) {
      hideEnemyCtxMenu();
    }
  });
}

export function destroyHudOverlay() {
  if (hudState.root) {
    hudState.root.innerHTML = "";
    hudState.root = null;
  }
  hudState.slotNodes.clear();
  hudState.rackSwitchNodes.clear();
  hudState.lockCards.clear();
  // Clean up any hud windows
  document.querySelectorAll('[id^="hud-win-"]').forEach((el) => el.remove());
}

/* ── Update ── */
export function updateHudOverlay(Wc: number, Hc: number, now: number) {
  if (!hudState.root) return;

  // Dismiss onboarding when pilot sets a waypoint/moves
  if (!localStorage.getItem("novus-onboarded") && Client.waypoint !== null) {
    const onboardEl = document.getElementById("hud-onboard");
    if (onboardEl && !onboardEl.classList.contains("fade-out")) {
      onboardEl.classList.add("fade-out");
      setTimeout(() => onboardEl.remove(), 1000);
      localStorage.setItem("novus-onboarded", "true");
    }
  }

  const sys = curSys();
  const st = getStats();
  const ship = SHIPS[G.P.shipId];

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

  // Status bars

  const barData = [
    [G.P.shield, st.maxShield],
    [G.P.hp, st.maxHp],
    [G.P.structure, G.P.maxStructure],
    [G.P.energy, st.maxEnergy],
  ];
  for (let i = 0; i < 4; i++) {
    const [val, max] = barData[i];
    const w = `${Math.max(0, Math.min(1, val / Math.max(1, max))) * 100}%`;
    if (hudState.statusFills[i].style.width !== w) hudState.statusFills[i].style.width = w;
  }

  updateSlots(ship, st, now);
  updateLockRail(st, now);
  updateDockPrompt(sys);
  updateHubWindowIfOpen();
  updateTractorDial();
  updateHubTooltip(sys);
  if (Client.overviewOpen) updateBridgeOverview();
  updateHudOverviewPanel();
  updateMissionsPanel();
  updateShipPanelLive();

  // Credits live in the Cargo Hold window footer now; keep it current while open.
  const credEl = document.getElementById("inv-credits-value");
  if (credEl) {
    const credText = `${Math.floor(G.P.credits).toLocaleString()}¢`;
    if (credEl.textContent !== credText) credEl.textContent = credText;
  }
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

export function toggleHubWindow() {
  if (isOpen("industrial-hub")) {
    closeHudWindow("industrial-hub");
    return;
  }
  const div = document.createElement("div");
  div.id = "hub-window-body";
  div.style.cssText = "padding:10px;min-width:300px;max-width:380px;color:#e0e0e0;font-size:11px;";
  renderHubWindowContent(div);
  openHudWindow("industrial-hub", "Industrial Processing Hub", div);
  attachHubWindowListeners(div);
}

function renderHubWindowContent(container: HTMLElement) {
  const now = Date.now() / 1000;
  const queue = G.P.hubQueue ?? [];
  const output = G.P.hubOutput ?? { loot: {}, ore: {}, modules: [] };

  let html = "";

  if (queue.length > 0) {
    html += `<div style="margin-bottom:8px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Processing Queue</div>`;
    for (const job of queue) {
      const elapsed = now - job.startTime;
      const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
      const label = job.kind === "asteroid" ? "Asteroid" : "Debris";
      const massTons = Math.round(job.mass / 100) / 10;
      const remaining = Math.max(0, job.duration - elapsed);
      html += `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span>${label} (${massTons}t)</span>
            <span style="color:#888;">${remaining < 1 ? "Ready soon…" : fmtDuration(remaining)}</span>
          </div>
          <div style="background:#1a1a1a;border:1px solid #333;height:6px;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${job.kind === "asteroid" ? "#ff8c20" : "#20aaff"};transition:width 0.5s;"></div>
          </div>
        </div>`;
    }
  } else {
    html += `<div style="color:#666;font-style:italic;margin-bottom:8px;">No active processing jobs.<br>Tow debris or asteroids into the collection ring to begin.</div>`;
  }

  const hasOutput = hasHubOutput();
  if (hasOutput) {
    html += `<div style="margin-top:8px;margin-bottom:6px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Ready to Collect</div>`;
    html += `<div style="background:#1e1a10;border:1px solid #4a3800;padding:6px 8px;border-radius:3px;margin-bottom:8px;">`;
    for (const [k, v] of Object.entries(output.loot)) {
      if ((v as number) > 0) html += `<div>${k}: <b style="color:#ffcc44;">${v}</b></div>`;
    }
    for (const [k, v] of Object.entries(output.ore)) {
      if ((v as number) > 0) html += `<div>${k} ore: <b style="color:#ff9933;">${v}</b></div>`;
    }
    for (const inst of output.modules) {
      html += `<div>Module: <b style="color:#99aaff;">${inst.baseId}</b></div>`;
    }
    html += `</div>`;
    html += `<button id="hub-collect-btn" style="width:100%;padding:6px;background:#3a2a05;border:1px solid #ff9922;color:#ffcc44;cursor:pointer;border-radius:3px;font-size:11px;">Collect All</button>`;
  }

  container.innerHTML = html;
}

function attachHubWindowListeners(container: HTMLElement) {
  container.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("#hub-collect-btn");
    if (!btn) return;
    const result = collectHubOutput();
    const items = [
      ...Object.entries(result.loot).filter(([, v]) => v > 0).map(([k, v]) => `${v}× ${k}`),
      ...Object.entries(result.ore).filter(([, v]) => v > 0).map(([k, v]) => `${v}× ${k} ore`),
      ...result.modules.map(m => m.baseId),
    ];
    if (items.length > 0) {
      import("./hud/logs.js").then(m => m.logEvent(`Collected: ${items.join(", ")}`, "loot"));
    }
    renderHubWindowContent(container);
  });
}

export function updateHubWindowIfOpen() {
  if (!isOpen("industrial-hub")) return;
  const body = document.getElementById("hub-window-body");
  if (body) renderHubWindowContent(body);
}

export function toggleScannerDock() {
  if (hudState.scannerDock) {
    const hidden = hudState.scannerDock.style.display === "none";
    hudState.scannerDock.style.display = hidden ? "flex" : "none";
  }
}

/* ── Theme ──
 * Tokens are written to the document root so every DOM UI surface (HUD,
 * bridge windows, station screens, settings) inherits the active theme + font.
 * Re-applied each frame but short-circuited unless theme/font actually changed.
 */
let _appliedTheme = "";
let _appliedFont = "";
function applyTheme(themeId: string, fontId: string) {
  // Layout var on the HUD root.
  if (hudState.root) {
    hudState.root.style.setProperty("--hud-bottom-h", `${HUD_BOTTOM_H}px`);
  }
  if (themeId === _appliedTheme && fontId === _appliedFont) return;
  _appliedTheme = themeId;
  _appliedFont = fontId;

  const t = getTheme(themeId);
  const s = document.documentElement.style;
  // Font
  s.setProperty("--font-family", getFontStack(fontId));
  // Surfaces
  s.setProperty("--hud-bg-deep", t.bgDeep);
  s.setProperty("--hud-bg-window", t.bgWindow);
  s.setProperty("--hud-bg-panel", t.bgPanel);
  s.setProperty("--hud-bg-elevated", t.bgElevated);
  // Borders
  s.setProperty("--hud-border", t.border);
  s.setProperty("--hud-border-soft", t.borderSoft);
  s.setProperty("--hud-border-accent", t.borderAccent);
  // Text
  s.setProperty("--hud-text-bright", t.textBright);
  s.setProperty("--hud-text-main", t.textMain);
  s.setProperty("--hud-text-dim", t.textDim);
  s.setProperty("--hud-text-faint", t.textFaint);
  // Semantic accents
  s.setProperty("--hud-accent", t.accent);
  s.setProperty("--hud-positive", t.positive);
  s.setProperty("--hud-shield", t.shield);
  s.setProperty("--hud-hull", t.hull);
  s.setProperty("--hud-danger", t.danger);
  s.setProperty("--hud-cap", t.cap);
  s.setProperty("--hud-arcane", t.arcane ?? "#8858a8");
  // Legacy aliases used by existing layout CSS (top/bottom bars).
  s.setProperty("--hud-top-bar", t.bgDeep);
  s.setProperty("--hud-top-border", t.border);
  s.setProperty("--hud-bottom-top", t.bgPanel);
  s.setProperty("--hud-bottom-bot", t.bgDeep);
  s.setProperty("--hud-bottom-border", t.borderAccent);
}

/** Force a re-apply (e.g. after the player changes theme/font in settings). */
export function refreshTheme() {
  _appliedTheme = "";
  _appliedFont = "";
  applyTheme(Client.settings?.theme || "default", Client.settings?.fontFamily || "Orbitron");
}
