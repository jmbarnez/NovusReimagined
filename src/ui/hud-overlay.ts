import "./styles/hud-base.css";
import "./styles/hud-sys-info.css";
import "./styles/hud-status-bars.css";
import "./styles/hud-misc.css";
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
import { toggleHudWindow, closeHudWindow } from "./hud/windows.js";
import "./styles/bridge.css";

import { hudState } from "./hud/state.js";
import { updateSlots } from "./hud/slots.js";
import { updateLockRail } from "./hud/targeting.js";
import { updateDockPrompt, updateHudOverviewPanel, updateHudOverviewPanelHeaders } from "./hud/overview.js";
import { hideTurretCtxMenu } from "./hud/turret-menu.js";

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

    <div id="hud-minimap"></div>

    <div id="hud-bottom">
      <div id="hud-log-panel">
        <div id="hud-log-header">EVENT LOG</div>
        <div id="hud-log-entries"></div>
      </div>
      <div id="hud-bottom-right">
        <div id="hud-status-bars">
          <div id="hud-speed" class="hud-bar-group">
            <span class="hud-bar-label speed-label">SPD 0</span>
            <div class="hud-bar-track"><span class="hud-bar-fill speed"></span></div>
          </div>
        </div>
        <div id="hud-slots"></div>
      </div>
      <div id="hud-scanner-dock">
        <div id="hud-scanner-body">
          <div id="hud-overview-panel">
            <div class="ov-wrap">
              <table class="ov-table">
                <thead><tr><th></th><th class="ov-sortable" data-sort="state">State</th><th class="ov-sortable" data-sort="class">Class</th><th class="ov-sortable" data-sort="name">Name</th><th class="ov-sortable" data-sort="dist">Dist</th><th>Act</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

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

  // Bind references
  hudState.root = overlay;
  hudState.sysName = overlay.querySelector("#hud-sys-name");
  hudState.secEl = overlay.querySelector("#hud-sec");
  hudState.lockRail = overlay.querySelector("#hud-lock-rail");
  hudState.dockPrompt = overlay.querySelector("#hud-dock-prompt");
  hudState.xpPopup = overlay.querySelector("#hud-xp-popup");
  hudState.logEntries = overlay.querySelector("#hud-log-entries");
  hudState.speedEl = overlay.querySelector("#hud-speed");
  hudState.slotsContainer = overlay.querySelector("#hud-slots");
  hudState.minimapContainer = overlay.querySelector("#hud-minimap");
  hudState.scannerDock = overlay.querySelector("#hud-scanner-dock");

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

  hudState.ovPanel!.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest(".ov-lock");
    if (!btn) return;
    sfxConfirm();
    const id = (btn as HTMLElement).dataset.lockId;
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
    document.addEventListener("click", (e) => {
      if (hudState.turretCtxMenu && !hudState.turretCtxMenu.contains(e.target as Node)) hideTurretCtxMenu();
    });
  } else {
    hudState.turretCtxMenu = document.getElementById("turret-ctx-menu");
  }
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
  const speed = Math.hypot(G.P.vx, G.P.vy);
  const maxSpeed = st.maxSpeed || 1;
  const baseMax = st.baseMaxSpeed || 1;
  const speedText = `${Math.round(speed)} m/s`;
  const spdLbl = hudState.speedEl!.querySelector('.speed-label')!;
  if (spdLbl.textContent !== speedText) spdLbl.textContent = speedText;
  
  const spdFill = hudState.speedEl!.querySelector('.hud-bar-fill') as HTMLElement;
  const spdW = `${Math.max(0, Math.min(1, speed / maxSpeed)) * 100}%`;
  if (spdFill.style.width !== spdW) spdFill.style.width = spdW;

  const isOverdrive = speed > baseMax + 1;
  if (isOverdrive && !spdFill.classList.contains('overdrive')) spdFill.classList.add('overdrive');
  else if (!isOverdrive && spdFill.classList.contains('overdrive')) spdFill.classList.remove('overdrive');

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
  if (Client.overviewOpen) updateBridgeOverview();
  updateHudOverviewPanel();
  updateMissionsPanel();
}

/* ── Public helpers for window toggling (called from input.ts) ── */
export function toggleCargoWindow() {
  const div = document.createElement("div");
  div.id = "bridge-pane-cargo";
  div.className = "br-pane";
  div.style.height = "100%";
  div.style.width = "100%";
  div.style.overflow = "hidden";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.innerHTML = renderInventoryHTML();
  toggleHudWindow("cargo", "Cargo Hold", div);
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

export function toggleContractsWindow() {
  const el = getMissionsPanelEl();
  if (el) {
    toggleHudWindow("missions", "Contracts", el);
    updateMissionsPanel();
  }
}

export function toggleScannerDock() {
  if (hudState.scannerDock) {
    const hidden = hudState.scannerDock.style.display === "none";
    hudState.scannerDock.style.display = hidden ? "flex" : "none";
  }
}

export function closeHudWindows() {
  closeHudWindow("cargo");
  closeHudWindow("missions");
  closeHudWindow("skills");
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
