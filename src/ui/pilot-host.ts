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
import { t } from "../utils/i18n.js";

interface PilotHostScreenOptions {
  mount?: HTMLElement;
  embedded?: boolean;
}

function pilotNameFromSave(): string {
  if (!localStorage.getItem(SAVE_KEY)) return "";
  try {
    const p = loadPlayer();
    return p.pilotName?.trim() ?? "";
  } catch {
    return "";
  }
}

export function showPilotHostScreen(onClose: () => void, options: PilotHostScreenOptions = {}): void {
  const callsign = pilotNameFromSave();
  const hasPilot = callsign.length >= 3;
  const listenAddr = `127.0.0.1:${getMultiplayerPort()}`;
  const tauriNote = isTauriApp()
    ? "Desktop relay active — remote clients may connect via LAN."
    : "Browser host uses embedded worker; external clients need the desktop build for WS relay.";

  const terminal = createPilotTerminalOverlay({
    id: "pilot-host-screen",
    title: t("pilotTerminal.hostRelay"),
    subtitle: t("pilotTerminal.pilotComputer"),
    mount: options.mount,
    embedded: options.embedded,
    showConsole: !options.embedded,
    dashboardHtml: `
      <div class="pilot-terminal-meta-row">
        <span class="meta-label">${t("pilotTerminal.callsign")}</span>
        <span class="meta-val">${hasPilot ? callsign : t("pilotTerminal.unregistered")}</span>
      </div>
      <div class="pilot-terminal-meta-row">
        <span class="meta-label">${t("pilotTerminal.listen")}</span>
        <span class="meta-val" data-host-addr>${listenAddr}</span>
      </div>
      <p class="pilot-terminal-readonly pilot-terminal-hint">${tauriNote}</p>
      <div class="pilot-terminal-actions">
        <button type="button" class="btn-pilot-primary" data-host-start ${hasPilot ? "" : "disabled"}>${t("pilotTerminal.startHostRelay")}</button>
        <button type="button" class="btn-pilot-secondary" data-host-copy ${hasPilot ? "" : "disabled"}>${t("pilotTerminal.copyAddress")}</button>
        <button type="button" class="btn-pilot-secondary btn-menu-back" data-host-close>${t("pilotTerminal.back")}</button>
      </div>
      ${hasPilot ? "" : `<p class="pilot-terminal-error" style="margin-top:12px;">${t("pilotTerminal.createPilotBeforeHosting")}</p>`}
    `,
  });

  terminal.setStatus(hasPilot ? t("pilotTerminal.relayStandby") : t("pilotTerminal.pilotRegistryRequired"));
  appendLogEntry(t("pilotTerminal.hostRelayOnline"), "system");
  if (hasPilot) {
    appendLogEntry(t("pilotTerminal.broadcastAddress", { address: listenAddr }), "info");
  } else {
    appendLogEntry(t("pilotTerminal.noCallsignHostingLocked"), "warn");
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
      appendLogEntry(t("pilotTerminal.addressCopied"), "net-ok");
    } catch {
      appendLogEntry(t("pilotTerminal.clipboardUnavailable"), "warn");
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
      label: t("pilotTerminal.initializingHostRelay"),
      subtitle: t("pilotTerminal.serverWorker"),
      targetLine: listenAddr,
      mount: options.mount,
      embedded: options.embedded,
      task: () => ensureGameplayConnected({ reconnectLocal: true }),
      onSuccess: async () => {
        await enterSpaceMode();
        logEvent(`Host relay active on ${listenAddr}`, "system");
        netLog(`[OK] Host listening ${listenAddr}`);
      },
      onFailure: () => {
        showPilotHostScreen(onClose, options);
      },
    });
  });
}
