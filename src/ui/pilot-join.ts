import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { getMultiplayerPort, connectToRemote, enterSpaceMode } from "../game-loop.js";
import { logEvent } from "./hud-overlay.js";
import { prepareRemoteJoinPilot } from "../utils/restore-save.js";
import { loadPlayer } from "../player/player-data.js";
import { netLog } from "./net-console.js";
import { createPilotTerminalOverlay } from "./pilot-terminal/layout.js";
import { appendLogEntry } from "./hud/logs.js";
import { runPilotConnection } from "./pilot-connecting.js";
import { showPilotProfileScreen } from "./pilot-profile.js";
import {
  discoverLanSessions,
  stopSessionDiscovery,
  type DiscoveredSession,
} from "../net/session-discovery.js";
interface SavedServer {
  name: string;
  address: string;
}

interface ShowPilotJoinOptions {
  autoScan?: boolean;
  onClose: () => void;
  onBack?: () => void;
}

function loadSavedServers(): SavedServer[] {
  try {
    const raw = localStorage.getItem("novus_saved_servers");
    if (raw) return JSON.parse(raw) as SavedServer[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveServers(list: SavedServer[]): void {
  localStorage.setItem("novus_saved_servers", JSON.stringify(list));
}

function pilotNameFromSave(): string {
  try {
    const p = loadPlayer();
    return p.pilotName?.trim() ?? "";
  } catch {
    return "";
  }
}

export function showPilotJoinScreen(options: ShowPilotJoinOptions): void {
  const lastAddress = localStorage.getItem("novus_last_join_address") || `127.0.0.1:${getMultiplayerPort()}`;
  const callsign = pilotNameFromSave();
  const hasPilot = callsign.length >= 3;
  let savedServers = loadSavedServers();
  let selectedAddress = lastAddress;
  let scanning = false;

  const terminal = createPilotTerminalOverlay({
    id: "pilot-join-screen",
    title: "JOIN SESSION",
    subtitle: "SESSION FINDER",
    showConsole: true,
    dashboardHtml: `
      <div class="pilot-session-list-wrap">
        <div class="pilot-terminal-dashboard-label">DISCOVERED RELAYS</div>
        <div class="pilot-session-list" data-session-list>
          <div class="pilot-session-empty">Scanning neural band…</div>
        </div>
      </div>
      <div class="pilot-terminal-field">
        <label for="join-address-input">MANUAL ADDRESS</label>
        <input type="text" id="join-address-input" class="pilot-terminal-input" value="${lastAddress}" placeholder="IP:PORT" autocomplete="off" />
      </div>
      <div class="pilot-terminal-actions">
        <button type="button" class="btn-pilot-secondary" data-join-scan>SCAN LAN</button>
        <button type="button" class="btn-pilot-primary" data-join-connect>${hasPilot ? "CONNECT" : "CREATE PROFILE"}</button>
        <button type="button" class="btn-pilot-secondary btn-menu-back" data-join-back>BACK</button>
      </div>
      ${hasPilot ? "" : `<p class="pilot-terminal-error" style="margin-top:12px;">Create a pilot callsign before joining multiplayer.</p>`}
    `,
  });

  terminal.setStatus(options.autoScan ? "SCANNING LOCAL NET" : "SELECT OR ENTER HOST");

  const listEl = terminal.dashboardMain.querySelector("[data-session-list]") as HTMLElement;
  const addrInput = terminal.dashboardMain.querySelector("#join-address-input") as HTMLInputElement;
  const scanBtn = terminal.dashboardMain.querySelector("[data-join-scan]") as HTMLButtonElement;
  const connectBtn = terminal.dashboardMain.querySelector("[data-join-connect]") as HTMLButtonElement;
  const backBtn = terminal.dashboardMain.querySelector("[data-join-back]") as HTMLButtonElement;

  const renderSessions = (discovered: DiscoveredSession[], saved: SavedServer[]) => {
    const rows: string[] = [];
    const seen = new Set<string>();

    for (const s of discovered) {
      seen.add(s.address);
      const sel = s.address === selectedAddress ? " pilot-session-row--selected" : "";
      rows.push(
        `<button type="button" class="pilot-session-row${sel}" data-addr="${s.address}">${s.label}</button>`,
      );
    }
    for (const s of saved) {
      if (seen.has(s.address)) continue;
      const sel = s.address === selectedAddress ? " pilot-session-row--selected" : "";
      rows.push(
        `<button type="button" class="pilot-session-row${sel}" data-addr="${s.address}">${s.name} · ${s.address}</button>`,
      );
    }
    if (rows.length === 0) {
      listEl.innerHTML = `<div class="pilot-session-empty">No relays found. Host a session or enter an address.</div>`;
    } else {
      listEl.innerHTML = rows.join("");
    }

    listEl.querySelectorAll("[data-addr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sfxBlip();
        selectedAddress = (btn as HTMLElement).dataset.addr ?? selectedAddress;
        addrInput.value = selectedAddress;
        listEl.querySelectorAll(".pilot-session-row").forEach((row) => {
          row.classList.toggle("pilot-session-row--selected", (row as HTMLElement).dataset.addr === selectedAddress);
        });
      });
    });
  };

  const runScan = async () => {
    if (scanning) return;
    scanning = true;
    scanBtn.disabled = true;
    terminal.setStatus("SCANNING LOCAL NET");
    appendLogEntry("Scanning subnet for neural relays…", "net");
    listEl.innerHTML = `<div class="pilot-session-empty">Scanning…</div>`;

    const discovered: DiscoveredSession[] = [];
    await discoverLanSessions((batch) => {
      for (const s of batch) {
        if (!discovered.some((d) => d.id === s.id)) discovered.push(s);
      }
      renderSessions(discovered, savedServers);
      if (discovered.length > 0) {
        appendLogEntry(`Found ${discovered.length} relay(s).`, "net-ok");
      }
    });

    if (discovered.length === 0) {
      appendLogEntry("No relays detected on local network.", "warn");
    }
    renderSessions(discovered, savedServers);
    scanning = false;
    scanBtn.disabled = false;
    terminal.setStatus("SCAN COMPLETE");
  };

  const close = () => {
    stopSessionDiscovery();
    terminal.remove();
    options.onClose();
  };

  backBtn.addEventListener("click", () => {
    sfxBlip();
    close();
    options.onBack?.();
  });

  scanBtn.addEventListener("click", () => {
    sfxBlip();
    void runScan();
  });

  connectBtn.addEventListener("click", () => {
    sfxConfirm();
    if (!hasPilot) {
      stopSessionDiscovery();
      terminal.remove();
      showPilotProfileScreen(
        () => {
          showPilotJoinScreen(options);
        },
        () => {
          showPilotJoinScreen(options);
        },
      );
      return;
    }
    const address = addrInput.value.trim() || `127.0.0.1:${getMultiplayerPort()}`;
    localStorage.setItem("novus_last_join_address", address);
    selectedAddress = address;

    const existingIdx = savedServers.findIndex((s) => s.address === address);
    if (existingIdx === -1) {
      savedServers.push({ name: `Relay ${savedServers.length + 1}`, address });
      saveServers(savedServers);
    }

    stopSessionDiscovery();
    terminal.remove();
    options.onClose();

    prepareRemoteJoinPilot();
    runPilotConnection({
      label: "NEURAL HANDSHAKE",
      subtitle: "REMOTE SYNC",
      targetLine: address,
      task: () => connectToRemote(address),
      onSuccess: async () => {
        await enterSpaceMode();
        logEvent(`Neural link established to remote server: ${address}`, "system");
        netLog(`[OK] Join complete → ${address}`);
      },
      onFailure: () => {
        showPilotJoinScreen(options);
      },
    });
  });

  renderSessions([], savedServers);
  if (options.autoScan) {
    void runScan();
  } else {
    listEl.innerHTML = `<div class="pilot-session-empty">Press Scan LAN or enter an address below.</div>`;
  }
}
