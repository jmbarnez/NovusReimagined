import "../styles/hud-base.css";
import "../styles/pilot-terminal.css";
import "../styles/hud-logs.css";
import { h, render } from "preact";
import { t } from "../../utils/i18n.js";
import { createElement, append, setText } from "../dom-helpers.js";
import { PilotTerminalView } from "./layout-view.js";

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

  render(
    h(PilotTerminalView, {
      title: options.title,
      subtitle: options.subtitle,
      embedded: options.embedded,
      dashboardHtml: options.dashboardHtml,
      showConsole,
      showAbort: options.showAbort === true,
      abortLabel: options.abortLabel ?? t("pilotTerminal.abort"),
      onAbort: options.onAbort,
    }),
    overlay
  );

  append(options.mount ?? document.body, overlay);

  const statusEl = overlay.querySelector("[data-pilot-status]") as HTMLElement;
  const dashboardMain = overlay.querySelector("[data-pilot-dashboard]") as HTMLElement;
  const consoleEntries = overlay.querySelector("[data-pilot-console]") as HTMLElement | null;

  const originalRemove = overlay.remove.bind(overlay);
  const remove = () => {
    render(null, overlay);
    originalRemove();
  };

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
