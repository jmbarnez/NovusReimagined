import { sfxBlip } from "../../audio/procedural.js";
import { bindWindowChromeButton, panelPopoutButtonHTML, resetWindowExpand } from "./window-chrome.js";
import { openHudWindow, getHudWindow } from "./windows.js";
import { hudState } from "./state.js";

export type PanelPopoutId = "event-log" | "scanner";

interface PanelPopoutConfig {
  windowId: string;
  title: string;
  dockHostSel: string;
  contentMountSel: string;
  popoutFlag: "logPopout" | "scannerPopout";
  popoutBtnSel: string;
}

const PANELS: Record<PanelPopoutId, PanelPopoutConfig> = {
  "event-log": {
    windowId: "event-log",
    title: "COMMS LOG",
    dockHostSel: "#hud-log-panel",
    contentMountSel: "#hud-log-body",
    popoutFlag: "logPopout",
    popoutBtnSel: "#hud-log-header .hud-panel-popout",
  },
  scanner: {
    windowId: "scanner-overview",
    title: "LOCAL OVERVIEW",
    dockHostSel: "#hud-scanner-dock",
    contentMountSel: "#hud-scanner-body",
    popoutFlag: "scannerPopout",
    popoutBtnSel: "#hud-scanner-header .hud-panel-popout",
  },
};

function cfg(id: PanelPopoutId): PanelPopoutConfig {
  return PANELS[id];
}

function dockHost(id: PanelPopoutId): HTMLElement | null {
  return document.querySelector(cfg(id).dockHostSel);
}

function contentMount(id: PanelPopoutId): HTMLElement | null {
  return document.querySelector(cfg(id).contentMountSel);
}

function floatingWindow(id: PanelPopoutId): HTMLElement | null {
  return getHudWindow(cfg(id).windowId);
}

export function isPanelPopout(id: PanelPopoutId): boolean {
  return hudState[cfg(id).popoutFlag];
}

export function isPanelVisible(id: PanelPopoutId): boolean {
  if (isPanelPopout(id)) {
    const win = floatingWindow(id);
    return !!win && win.style.display !== "none";
  }
  const host = dockHost(id);
  return !!host && host.style.display !== "none";
}

function measureDockRect(host: HTMLElement): DOMRect {
  const wasHidden = host.style.display === "none";
  if (wasHidden) {
    host.style.display = "flex";
    host.style.visibility = "hidden";
    const rect = host.getBoundingClientRect();
    host.style.visibility = "";
    host.style.display = "none";
    return rect;
  }
  return host.getBoundingClientRect();
}

export function dockInPanel(id: PanelPopoutId): void {
  if (!isPanelPopout(id)) return;

  const c = cfg(id);
  const host = dockHost(id);
  const mount = contentMount(id);
  const win = floatingWindow(id);
  if (!host || !mount) return;

  host.appendChild(mount);
  hudState[c.popoutFlag] = false;

  if (win) {
    resetWindowExpand(win, { capturePosition: true });
  }

  host.style.display = "flex";
}

export function popOutPanel(id: PanelPopoutId): void {
  if (isPanelPopout(id)) return;

  const c = cfg(id);
  const host = dockHost(id);
  const mount = contentMount(id);
  if (!host || !mount) return;

  sfxBlip();
  const rect = measureDockRect(host);
  hudState[c.popoutFlag] = true;
  host.style.display = "none";

  openHudWindow(c.windowId, c.title, mount, () => dockInPanel(id));

  const win = floatingWindow(id);
  if (win) {
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.width = `${Math.max(rect.width, 240)}px`;
    win.style.height = `${Math.max(rect.height, 120)}px`;
  }
}

export function togglePanelVisibility(id: PanelPopoutId): void {
  if (isPanelPopout(id)) {
    const win = floatingWindow(id);
    if (!win) return;
    const hidden = win.style.display === "none";
    win.style.display = hidden ? "flex" : "none";
    return;
  }

  const host = dockHost(id);
  if (!host) return;
  const hidden = host.style.display === "none";
  host.style.display = hidden ? "flex" : "none";
}

export function initPanelPopouts(): void {
  for (const id of Object.keys(PANELS) as PanelPopoutId[]) {
    const c = cfg(id);
    const btn = document.querySelector(c.popoutBtnSel) as HTMLElement | null;
    if (!btn || btn.dataset.bound === "true") continue;
    btn.dataset.bound = "true";
    bindWindowChromeButton(btn);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      popOutPanel(id);
    });
  }
}

/** Inject pop-out buttons into dock headers (called once from initHudOverlay markup). */
export function buildDockHeaderHTML(title: string): string {
  return `<span class="hud-dock-title">${title}</span><span style="flex:1"></span>${panelPopoutButtonHTML()}`;
}
