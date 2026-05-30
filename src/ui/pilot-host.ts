import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { getState } from "../state-access.js";
import { SAVE_KEY } from "../constants.js";
import { loadPlayer } from "../player/player-data.js";
import { ensureGameplayConnected, enterSpaceMode, getMultiplayerPort } from "../game-loop.js";
import { restoreGameFromSave } from "../utils/restore-save.js";
import { logEvent } from "./hud-overlay.js";
import { createPilotTerminalOverlay } from "./pilot-terminal/layout.js";
import { appendLogEntry } from "./hud/logs.js";
import { runPilotConnection } from "./pilot-connecting.js";
import { isTauriApp } from "../utils/app-exit.js";
import { netLog } from "./net-console.js";

function pilotNameFromSave(): string {
  if (!localStorage.getItem(SAVE_KEY)) return "";
  try {
    const p = loadPlayer();
    return p.pilotName?.trim() ?? "";
  } catch {
    return "";
  }
}

export function showPilotHostScreen(onClose: () => void): void {
  const callsign = pilotNameFromSave();
  const hasPilot = callsign.length >= 3;
  const listenAddr = `127.0.0.1:${getMultiplayerPort()}`;
  const tauriNote = isTauriApp()
    ? "Desktop relay active — remote clients may connect via LAN."
    : "Browser host uses embedded worker; external clients need the desktop build for WS relay.";

  const terminal = createPilotTerminalOverlay({
    id: "pilot-host-screen",
    title: "HOST RELAY",
    subtitle: "PILOT COMPUTER",
    showConsole: true,
    dashboardHtml: `
      <div class="pilot-terminal-meta-row">
        <span class="meta-label">CALLSIGN</span>
        <span class="meta-val">${hasPilot ? callsign : "— UNREGISTERED —"}</span>
      </div>
      <div class="pilot-terminal-meta-row">
        <span class="meta-label">LISTEN</span>
        <span class="meta-val" data-host-addr>${listenAddr}</span>
      </div>
      <p class="pilot-terminal-readonly pilot-terminal-hint">${tauriNote}</p>
      <div class="pilot-terminal-actions">
        <button type="button" class="btn-pilot-primary" data-host-start ${hasPilot ? "" : "disabled"}>START HOST RELAY</button>
        <button type="button" class="btn-pilot-secondary" data-host-copy ${hasPilot ? "" : "disabled"}>COPY ADDRESS</button>
        <button type="button" class="btn-pilot-secondary btn-menu-back" data-host-close>BACK</button>
      </div>
      ${hasPilot ? "" : `<p class="pilot-terminal-error" style="margin-top:12px;">Create a pilot via Initiate New Link before hosting.</p>`}
    `,
  });

  terminal.setStatus(hasPilot ? "RELAY STANDBY" : "PILOT REGISTRY REQUIRED");
  appendLogEntry("Host relay terminal online.", "system");
  if (hasPilot) {
    appendLogEntry(`Broadcast address: ${listenAddr}`, "info");
  } else {
    appendLogEntry("No registered callsign — hosting locked.", "warn");
  }

  const startBtn = terminal.dashboardMain.querySelector("[data-host-start]") as HTMLButtonElement;
  const copyBtn = terminal.dashboardMain.querySelector("[data-host-copy]") as HTMLButtonElement;
  const closeBtn = terminal.dashboardMain.querySelector("[data-host-close]") as HTMLButtonElement;

  const close = () => {
    terminal.remove();
    onClose();
  };

  closeBtn.addEventListener("click", () => {
    sfxBlip();
    close();
  });

  copyBtn?.addEventListener("click", async () => {
    sfxBlip();
    try {
      await navigator.clipboard.writeText(listenAddr);
      appendLogEntry("Address copied to clipboard.", "net-ok");
    } catch {
      appendLogEntry("Clipboard unavailable.", "warn");
    }
  });

  startBtn?.addEventListener("click", () => {
    if (!hasPilot) return;
    sfxConfirm();
    terminal.remove();

    if (localStorage.getItem(SAVE_KEY)) {
      restoreGameFromSave();
    }
    netLog("Host relay requested");

    runPilotConnection({
      label: "INITIALIZING HOST RELAY",
      subtitle: "SERVER WORKER",
      targetLine: listenAddr,
      task: () => ensureGameplayConnected(),
      onSuccess: async () => {
        await enterSpaceMode();
        logEvent(`Host relay active on ${listenAddr}`, "system");
        netLog(`[OK] Host listening ${listenAddr}`);
      },
      onFailure: () => {
        showPilotHostScreen(onClose);
      },
    });
  });
}
