import "./styles/hud-base.css";
import "./styles/hud-sys-info.css";
import "./styles/hud-status-bars.css";
import "./styles/hud-misc.css";
import { G, Client } from "../state.js";
import { HUD_SIDE_W, HUD_SIDE_W_FULL, HUD_SIDE_W_COLLAPSED, HUD_BOTTOM_H, setHudSideWidth } from "../constants.js";
import { getThemeColors } from "../data/settings.js";
import { curSys } from "../utils/game.js";
import { getStats } from "../player/player-stats.js";
import { SHIPS } from "../data/ships.js";
import { requestSensorLock } from "../targeting.js";
import { updateBridgeOverview } from "./bridge.js";
import { sfxConfirm } from "../audio/procedural.js";
import { initMissionsPanel, updateMissionsPanel, getMissionsPanelEl } from "./hud-missions.js";
import { renderInventoryHTML, attachInventoryListeners } from "./inventory.js";
import { renderSkillsContent, initSkillsInteractions } from "./skills.js";
import "./styles/bridge.css";

import { hudState } from "./hud/state.js";
import { updateSlots } from "./hud/slots.js";
import { updateLockRail } from "./hud/targeting.js";
import { updateDockPrompt, updateHudOverviewPanel } from "./hud/overview.js";
import { hideTurretCtxMenu } from "./hud/turret-menu.js";

// Re-export specific pieces that were previously in this file so other imports don't break.
export { logEvent } from "./hud/logs.js";
export { showXpEarned } from "./hud/xp.js";
export { flashSlotFire } from "./hud/slots.js";

function switchTab(tabId: "overview" | "missions" | "cargo" | "skills") {
  hudState.activeTab = tabId;
  if (!hudState.sideContent || !hudState.sidePanel) return;

  // Update button classes
  hudState.sidePanel.querySelectorAll(".hud-side-tab-btn").forEach((btn: any) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Clear content and append active panel
  hudState.sideContent.innerHTML = "";
  if (tabId === "overview") {
    if (hudState.ovPanel) hudState.sideContent.appendChild(hudState.ovPanel);
  } else if (tabId === "missions") {
    const el = getMissionsPanelEl();
    if (el) hudState.sideContent.appendChild(el);
  } else if (tabId === "cargo") {
    const div = document.createElement("div");
    div.id = "bridge-pane-cargo";
    div.className = "br-pane";
    div.style.height = "100%";
    div.style.width = "100%";
    // Hide overflow at the pane level — the inner `.inv-table-wrap` owns the
    // scrollbar. Without this, two scroll layers can fight each other.
    div.style.overflow = "hidden";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.innerHTML = renderInventoryHTML();
    hudState.sideContent.appendChild(div);
    attachInventoryListeners();
  } else if (tabId === "skills") {
    const div = document.createElement("div");
    div.id = "bridge-pane-skills";
    div.className = "br-pane";
    div.style.height = "100%";
    div.style.overflow = "auto";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.innerHTML = renderSkillsContent();
    hudState.sideContent.appendChild(div);
    initSkillsInteractions(div);
  }
}

function toggleSidePanel() {
  const isCollapsed = HUD_SIDE_W === HUD_SIDE_W_COLLAPSED;
  setHudSideWidth(isCollapsed ? HUD_SIDE_W_FULL : HUD_SIDE_W_COLLAPSED);
  
  if (hudState.sidePanel) {
    hudState.sidePanel.classList.toggle("collapsed", !isCollapsed);
  }
  
  const btn = document.getElementById("hud-side-toggle");
  if (btn) btn.textContent = !isCollapsed ? "◀" : "▶";

  // Reflow everything
  window.dispatchEvent(new Event("resize"));
}

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
          <!-- Other bars injected below -->
        </div>
        <div id="hud-slots"></div>
      </div>
    </div>

    <div id="hud-side-panel">
      <button id="hud-side-toggle" type="button" title="Toggle Side Panel">▶</button>
      <div id="hud-side-minimap-container"></div>
      <div id="hud-side-tabs">
        <button type="button" class="hud-side-tab-btn" data-tab="overview" title="Scanner Overview">👁️</button>
        <button type="button" class="hud-side-tab-btn" data-tab="missions" title="Contracts">📜</button>
        <button type="button" class="hud-side-tab-btn" data-tab="cargo" title="Cargo">📦</button>
        <button type="button" class="hud-side-tab-btn" data-tab="skills" title="Skills">🎓</button>
      </div>
      <div id="hud-side-content"></div>
    </div>

    <div id="hud-help">
      <div class="hh-sect">Flight</div>
      <div class="hh-line"><span class="hh-k">RMB</span> Set Waypoint</div>
      <div class="hh-line"><span class="hh-k">Mouse</span> Aim</div>
      <div class="hh-line"><span class="hh-k">Space</span> Brake</div>
      <div class="hh-line"><span class="hh-k">Wheel</span> Zoom</div>
      <div class="hh-sect">Combat</div>
      <div class="hh-line"><span class="hh-k">Ctrl+LMB</span> Lock</div>
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
  hudState.sidePanel = overlay.querySelector("#hud-side-panel");
  hudState.sideContent = overlay.querySelector("#hud-side-content");

  // Side toggle event
  const sideToggle = overlay.querySelector("#hud-side-toggle") as HTMLElement;
  if (sideToggle) sideToggle.onclick = toggleSidePanel;

  // Status bars injection
  const bars = overlay.querySelector("#hud-status-bars")!;
  const barDefs: [string, string, string][] = [
    ["SHLD", "shield", "#44ccff"],
    ["HULL", "hull", "#ee9944"],
    ["STRC", "struct", "#ee4444"],
    ["CAP", "cap", "#ffcc44"],
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

  // Tabs events
  overlay.querySelectorAll(".hud-side-tab-btn").forEach((btn: any) => {
    btn.onclick = () => {
      sfxConfirm();
      switchTab(btn.dataset.tab as any);
    };
  });

  // Overview panel
  hudState.ovPanel = document.createElement("div");
  hudState.ovPanel.id = "hud-overview-panel";
  hudState.ovPanel.innerHTML = `
    <div id="hud-overview-header">SCANNER OVERVIEW</div>
    <div class="ov-wrap">
      <table class="ov-table">
        <thead><tr><th></th><th>State</th><th>Class</th><th>Name</th><th>Dist</th><th>Act</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  hudState.ovEntries = hudState.ovPanel.querySelector("tbody");
  hudState.ovPanel.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest(".ov-lock");
    if (!btn) return;
    sfxConfirm();
    const id = (btn as HTMLElement).dataset.lockId;
    if (id) requestSensorLock(id);
  });

  initMissionsPanel(hudState.sidePanel!); 
  switchTab(hudState.activeTab);

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
}

/* ── Update ── */
export function updateHudOverlay(Wc: number, Hc: number, now: number) {
  if (!hudState.root) return;

  const sys = curSys();
  const st = getStats();
  const ship = SHIPS[G.P.shipId];

  applyTheme(Client.settings?.theme || "default");

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

/* ── Theme ── */
function applyTheme(themeId: string) {
  const t = getThemeColors(themeId);
  const s = hudState.root!.style;
  s.setProperty("--hud-side-w", `${HUD_SIDE_W}px`);
  s.setProperty("--hud-bottom-h", `${HUD_BOTTOM_H}px`);
  s.setProperty("--hud-top-bar", t.topBar);
  s.setProperty("--hud-top-border", t.topBarBorder);
  s.setProperty("--hud-bottom-top", t.bottomBarTop);
  s.setProperty("--hud-bottom-bot", t.bottomBarBottom);
  s.setProperty("--hud-bottom-border", t.bottomBarBorder);
  s.setProperty("--hud-text-main", t.textMain);
  s.setProperty("--hud-text-dim", t.textDim);
}
