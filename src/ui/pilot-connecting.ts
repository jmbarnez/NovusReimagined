import { sfxBlip } from "../audio/procedural.js";
import { gameClient } from "../game-loop.js";
import { createPilotTerminalOverlay } from "./pilot-terminal/layout.js";
import { registerLogSink, flushPendingLogEntries, appendLogEntry } from "./hud/logs.js";
import { flushNetLogPending } from "./net-console.js";
import { netLog } from "./net-console.js";
import { t } from "../utils/i18n.js";

export interface RunPilotConnectionOptions {
  label: string;
  subtitle?: string;
  targetLine?: string;
  mount?: HTMLElement;
  embedded?: boolean;
  task: () => Promise<boolean>;
  onSuccess: () => void | Promise<void>;
  onFailure: (err?: unknown) => void;
}

let activeConnectionAbort: (() => void) | null = null;

export function abortActivePilotConnection(): void {
  activeConnectionAbort?.();
  activeConnectionAbort = null;
}

export function runPilotConnection(options: RunPilotConnectionOptions): void {
  abortActivePilotConnection();

  let aborted = false;
  let finished = false;

  const terminal = createPilotTerminalOverlay({
    id: "pilot-connecting-screen",
    title: t("pilotTerminal.neuralLink"),
    subtitle: options.subtitle ?? t("pilotTerminal.synchronization"),
    mount: options.mount,
    embedded: options.embedded,
    showConsole: !options.embedded,
    showAbort: true,
    abortLabel: t("pilotTerminal.abortConnection"),
    dashboardHtml: options.targetLine
      ? `<div class="pilot-terminal-meta-row">
          <span class="meta-label">${t("pilotTerminal.target")}</span>
          <span class="meta-val" data-pilot-target>${options.targetLine}</span>
        </div>`
      : "",
    onAbort: () => {
      if (finished) return;
      aborted = true;
      sfxBlip();
      netLog(`[WARN] ${t("pilotTerminal.connectionAborted")}`);
      gameClient.disconnect();
      registerLogSink(null);
      terminal.remove();
      activeConnectionAbort = null;
      options.onFailure(new Error("aborted"));
    },
  });

  terminal.setStatus(options.label);
  if (!options.embedded) {
    registerLogSink(terminal.consoleEntries);
    flushPendingLogEntries();
    flushNetLogPending();
  }
  appendLogEntry(t("pilotTerminal.phase", { label: options.label }), "system");

  activeConnectionAbort = () => {
    if (!aborted && !finished) {
      aborted = true;
      gameClient.disconnect();
      registerLogSink(null);
      terminal.remove();
    }
  };

  void (async () => {
    try {
      const ok = await options.task();
      if (aborted) return;
      finished = true;
      activeConnectionAbort = null;
      registerLogSink(null);

      if (ok) {
        terminal.setStatus(t("pilotTerminal.linkEstablished"));
        appendLogEntry(t("pilotTerminal.neuralHandshakeComplete"), "net-ok");
        terminal.root.classList.add("fade-out");
        window.setTimeout(() => {
          terminal.remove();
          void Promise.resolve(options.onSuccess());
        }, 400);
      } else {
        terminal.setStatus(t("pilotTerminal.handshakeFailed"));
        appendLogEntry(t("pilotTerminal.couldNotEstablishLink"), "net-err");
        registerLogSink(null);
        terminal.remove();
        options.onFailure(new Error("connect failed"));
      }
    } catch (err) {
      if (aborted) return;
      finished = true;
      activeConnectionAbort = null;
      registerLogSink(null);
      terminal.setStatus("CONNECTION ERROR");
      appendLogEntry(`Exception: ${err}`, "net-err");
      terminal.remove();
      options.onFailure(err);
    }
  })();
}
