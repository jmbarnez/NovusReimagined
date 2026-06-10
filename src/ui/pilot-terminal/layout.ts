import "../styles/hud-base.css";
import "../styles/pilot-terminal.css";
import "../styles/hud-logs.css";
import { buildDockHeaderHTML } from "../hud/window-chrome.js";
import { t } from "../../utils/i18n.js";
import { createElement, setHtml, append, setText, onClick } from "../dom-helpers.js";

export interface PilotTerminalOverlay {
  root: HTMLElement;
  dashboardMain: HTMLElement;
  consoleEntries: HTMLElement;
  setStatus(text: string): void;
  remove(): void;
}

export interface CreatePilotTerminalOptions {
  id: string;
  title: string;
  subtitle?: string;
  mount?: HTMLElement;
  embedded?: boolean;
  /** Extra dashboard markup below the status line slot */
  dashboardHtml?: string;
  showConsole?: boolean;
  showAbort?: boolean;
  abortLabel?: string;
  onAbort?: () => void;
}

export function createPilotTerminalOverlay(options: CreatePilotTerminalOptions): PilotTerminalOverlay {
  const showConsole = options.showConsole !== false;
  const overlay = createElement("div");
  overlay.id = options.id;
  overlay.className = `pilot-terminal-overlay${options.embedded ? " pilot-terminal-overlay--embedded" : ""}`;

  setHtml(overlay, `
    <div class="pilot-terminal-corners" aria-hidden="true">
      <div class="pt-corner tl"></div>
      <div class="pt-corner tr"></div>
      <div class="pt-corner bl"></div>
      <div class="pt-corner br"></div>
    </div>
    <header class="pilot-terminal-header">
      <span class="pilot-terminal-title">${options.title}</span>
      ${options.subtitle ? `<span class="pilot-terminal-subtitle">${options.subtitle}</span>` : ""}
    </header>
    <div class="pilot-terminal-body">
      <section class="pilot-terminal-dashboard" aria-label="Dashboard">
        <span class="pilot-terminal-dashboard-label">${t("pilotTerminal.pilotInterface")}</span>
        <div class="pilot-terminal-status-line" data-pilot-status></div>
        <div class="pilot-terminal-dashboard-main" data-pilot-dashboard>
          ${options.dashboardHtml ?? ""}
        </div>
        ${
          options.showAbort
            ? `<div class="pilot-terminal-actions">
                <button type="button" class="btn-pilot-danger" data-pilot-abort>${options.abortLabel ?? t("pilotTerminal.abort")}</button>
              </div>`
            : ""
        }
      </section>
      ${
        showConsole
          ? `<section class="pilot-terminal-console-wrap" aria-label="${t("pilotTerminal.systemConsole")}">
              <div class="hud-dock-header">${buildDockHeaderHTML(t("pilotTerminal.systemConsole"))}</div>
              <div class="pilot-terminal-console-entries" data-pilot-console></div>
            </section>`
          : ""
      }
    </div>
  `);

  append(options.mount ?? document.body, overlay);

  const statusEl = overlay.querySelector("[data-pilot-status]") as HTMLElement;
  const dashboardMain = overlay.querySelector("[data-pilot-dashboard]") as HTMLElement;
  const consoleEntries = overlay.querySelector("[data-pilot-console]") as HTMLElement | null;

  const abortBtn = overlay.querySelector("[data-pilot-abort]") as HTMLButtonElement | null;
  if (abortBtn) onClick(abortBtn, () => options.onAbort?.());

  const originalRemove = overlay.remove.bind(overlay);
  const remove = () => originalRemove();

  return {
    root: overlay,
    dashboardMain,
    consoleEntries: consoleEntries ?? dashboardMain,
    setStatus(text: string) {
      if (statusEl) setText(statusEl, text);
    },
    remove,
  };
}
