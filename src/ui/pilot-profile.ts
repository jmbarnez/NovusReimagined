import { sfxBlip, sfxConfirm } from "../audio/procedural.js";

import { PlayerAccess, getState } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { savePlayer, validatePilotName } from "../player/player-data.js";
import { createPilotTerminalOverlay } from "./pilot-terminal/layout.js";
import { appendLogEntry } from "./hud/logs.js";
import { t } from "../utils/i18n.js";

interface PilotProfileScreenOptions {
  mount?: HTMLElement;
  embedded?: boolean;
}

export function showPilotProfileScreen(
  onComplete: (pilotName: string) => void,
  onCancel?: () => void,
  options: PilotProfileScreenOptions = {},
): void {
  const shipName = SHIPS[getState().player?.shipId ?? "scout"]?.name ?? "Class-I Scout";

  const terminal = createPilotTerminalOverlay({
    id: "pilot-profile-screen",
    title: t("pilot.title"),
    subtitle: t("pilot.subtitle"),
    mount: options.mount,
    embedded: options.embedded,
    showConsole: !options.embedded,
    dashboardHtml: `
      <div class="pilot-terminal-field">
        <label for="pilot-name-input">${t("pilot.callsign")}</label>
        <input type="text" id="pilot-name-input" class="pilot-terminal-input" maxlength="16" autocomplete="off" placeholder="${t("pilot.callsignPlaceholder")}" />
        <div class="pilot-terminal-error" data-pilot-name-error></div>
      </div>
      <div class="pilot-terminal-field">
        <label>${t("pilot.hullClass")}</label>
        <div class="pilot-terminal-readonly">${shipName}</div>
      </div>
      <div class="pilot-terminal-actions">
        <button type="button" class="btn-pilot-primary" data-pilot-confirm>${t("pilot.establish")}</button>
        <button type="button" class="btn-pilot-secondary btn-menu-back" data-pilot-cancel>${t("pilot.back")}</button>
      </div>
    `,
  });

  terminal.setStatus(t("pilot.awaiting"));
  appendLogEntry(t("pilot.registryOnline"), "system");
  appendLogEntry(t("pilot.assignCallsign"), "info");

  const input = terminal.dashboardMain.querySelector("#pilot-name-input") as HTMLInputElement;
  const errorEl = terminal.dashboardMain.querySelector("[data-pilot-name-error]") as HTMLElement;
  const confirmBtn = terminal.dashboardMain.querySelector("[data-pilot-confirm]") as HTMLButtonElement;
  const cancelBtn = terminal.dashboardMain.querySelector("[data-pilot-cancel]") as HTMLButtonElement;

  const finish = () => {
    terminal.remove();
  };

  const submit = () => {
    const result = validatePilotName(input.value);
    if (!result.ok) {
      errorEl.textContent = result.error ?? t("pilot.invalidCallsign");
      sfxBlip();
      return;
    }
    sfxConfirm();
    const pilotName = result.name ?? input.value.trim();
    PlayerAccess.setPilotName(pilotName);
    savePlayer();
    appendLogEntry(`Callsign registered: ${pilotName}`, "net-ok");
    finish();
    onComplete(pilotName);
  };

  confirmBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  });

  cancelBtn?.addEventListener("click", () => {
    sfxBlip();
    finish();
    onCancel?.();
  });

  window.setTimeout(() => input.focus(), 80);
}
