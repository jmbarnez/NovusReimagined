import { sfxBlip } from "../../audio/procedural.js";
import { bindWindowChromeButton, panelPopoutButtonHTML, resetWindowExpand } from "./window-chrome.js";
import { openHudWindow, getHudWindow } from "./windows.js";
import { hudState } from "./state.js";
import { query, getStyleProperty, setStyle, setPosition, append, onClick } from "../dom-helpers.js";

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
  return query(cfg(id).dockHostSel);
}

function contentMount(id: PanelPopoutId): HTMLElement | null {
  return query(cfg(id).contentMountSel);
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
    return !!win && getStyleProperty(win, "display") !== "none";
  }
  const host = dockHost(id);
  return !!host && getStyleProperty(host, "display") !== "none";
}

function measureDockRect(host: HTMLElement): DOMRect {
  const wasHidden = getStyleProperty(host, "display") === "none";
  if (wasHidden) {
    setStyle(host, { display: "flex", visibility: "hidden" });
    const rect = host.getBoundingClientRect();
    setStyle(host, { visibility: "", display: "none" });
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

  append(host, mount);
  hudState[c.popoutFlag] = false;

  if (win) {
    resetWindowExpand(win, { capturePosition: true });
  }

  setStyle(host, { display: "flex" });
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
  setStyle(host, { display: "none" });

  openHudWindow(c.windowId, c.title, mount, () => dockInPanel(id));

  const win = floatingWindow(id);
  if (win) {
    setPosition(win, `${rect.left}px`, `${rect.top}px`);
    setStyle(win, { width: `${Math.max(rect.width, 240)}px`, height: `${Math.max(rect.height, 120)}px` });
  }
}

export function togglePanelVisibility(id: PanelPopoutId): void {
  if (isPanelPopout(id)) {
    const win = floatingWindow(id);
    if (!win) return;
    const hidden = getStyleProperty(win, "display") === "none";
    setStyle(win, { display: hidden ? "flex" : "none" });
    return;
  }

  const host = dockHost(id);
  if (!host) return;
  const hidden = getStyleProperty(host, "display") === "none";
  setStyle(host, { display: hidden ? "flex" : "none" });
}

export function initPanelPopouts(): void {
  for (const id of Object.keys(PANELS) as PanelPopoutId[]) {
    const c = cfg(id);
    const btn = query(c.popoutBtnSel);
    if (!btn || btn.dataset.bound === "true") continue;
    btn.dataset.bound = "true";
    bindWindowChromeButton(btn);
    onClick(btn, (ev) => {
      (ev as MouseEvent).stopPropagation();
      popOutPanel(id);
    });
  }
}

/** Inject pop-out buttons into dock headers (called once from initHudOverlay markup). */
export function buildDockHeaderHTML(title: string): string {
  return `<span class="hud-dock-title">${title}</span><span style="flex:1"></span>${panelPopoutButtonHTML()}`;
}
