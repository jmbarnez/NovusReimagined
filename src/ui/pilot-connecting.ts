import { sfxBlip } from "../audio/procedural.js";
import { gameClient } from "../game-loop.js";
import { createPilotTerminalOverlay } from "./pilot-terminal/layout.js";
import { registerLogSink, flushPendingLogEntries, appendLogEntry } from "./hud/logs.js";
import { flushNetLogPending } from "./net-console.js";
import { netLog } from "./net-console.js";

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
    title: "NEURAL LINK",
    subtitle: options.subtitle ?? "SYNCHRONIZATION",
    mount: options.mount,
    embedded: options.embedded,
    showConsole: !options.embedded,
    showAbort: true,
    abortLabel: "ABORT CONNECTION",
    dashboardHtml: options.targetLine
      ? `<div class="pilot-terminal-meta-row">
          <span class="meta-label">TARGET</span>
          <span class="meta-val" data-pilot-target>${options.targetLine}</span>
        </div>`
      : "",
    onAbort: () => {
      if (finished) return;
      aborted = true;
      sfxBlip();
      netLog("[WARN] Connection aborted by pilot");
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
  appendLogEntry(`Phase: ${options.label}`, "system");

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
        terminal.setStatus("LINK ESTABLISHED");
        appendLogEntry("Neural handshake complete.", "net-ok");
        terminal.root.classList.add("fade-out");
        window.setTimeout(() => {
          terminal.remove();
          void Promise.resolve(options.onSuccess());
        }, 400);
      } else {
        terminal.setStatus("HANDSHAKE FAILED");
        appendLogEntry("Could not establish neural link.", "net-err");
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
