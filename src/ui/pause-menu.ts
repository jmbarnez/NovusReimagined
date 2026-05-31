import "./styles/pause-menu.css";
import { Client, AppMode } from "../state.js";
import { savePlayer } from "../player/player-data.js";
import { restoreGameFromSave } from "../utils/restore-save.js";
import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { openSettings } from "./settings/index.js";
import { logEvent } from "./hud-overlay.js";
import { getState } from "../state-access.js";
import { syncActiveProfile } from "../data/profiles.js";
import { t } from "../utils/i18n.js";
import { on } from "../events.js";

export function initPauseMenu() {
  if (document.getElementById("pause-overlay")) return;

  const el = document.createElement("div");
  el.id = "pause-overlay";
  el.innerHTML = `
    <div class="pause-panel">
      <h2 class="pause-title">${t("pause.title")}</h2>
      <button type="button" id="pause-resume" class="pause-btn pause-btn-primary">${t("pause.resume")}</button>
      <button type="button" id="pause-save" class="pause-btn">${t("pause.save")}</button>
      <button type="button" id="pause-load" class="pause-btn">${t("pause.load")}</button>
      <button type="button" id="pause-settings" class="pause-btn">${t("pause.settings")}</button>
      <button type="button" id="pause-exit" class="pause-btn pause-btn-exit">${t("pause.exit")}</button>
    </div>`;
  document.body.appendChild(el);

  on("ui:close-overlays", () => {
    el.style.display = "none";
    Client.pauseOpen = false;
  });

  el.querySelector("#pause-resume")!.addEventListener("click", () => {
    sfxBlip();
    closePauseMenu();
  });

  el.querySelector("#pause-save")!.addEventListener("click", () => {
    sfxConfirm();
    savePlayer();
    const btn = el.querySelector("#pause-save") as HTMLButtonElement;
    btn.textContent = t("common.saved");
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = t("pause.save");
      btn.disabled = false;
    }, 1200);
  });

  el.querySelector("#pause-load")!.addEventListener("click", () => {
    sfxBlip();
    if (
      !confirm(
        t("pause.confirmLoad")
      )
    ) {
      return;
    }
    if (!restoreGameFromSave()) {
      alert(t("pause.noSave"));
      return;
    }
    sfxConfirm();
    closePauseMenu();
    const sys = getState().GALAXY[getState().player.sysIdx];
    if (sys) {
      logEvent(`Save loaded. System entry: ${sys.name} (SEC ${sys.security.toFixed(1)})`, "system");
    }
  });

  el.querySelector("#pause-settings")!.addEventListener("click", () => {
    sfxBlip();
    openSettings();
  });

  el.querySelector("#pause-exit")!.addEventListener("click", () => {
    sfxBlip();
    if (
      !confirm(
        t("pause.confirmExit")
      )
    ) {
      return;
    }
    syncActiveProfile();
    window.location.reload();
  });
}

export function openPauseMenu() {
  if (!Client.gameStarted || Client.mode !== AppMode.SPACE || Client.stationOpen) return;
  initPauseMenu();
  Client.pauseOpen = true;
  const el = document.getElementById("pause-overlay") as HTMLElement;
  el.style.display = "flex";
}

export function closePauseMenu() {
  Client.pauseOpen = false;
  const el = document.getElementById("pause-overlay");
  if (el) el.style.display = "none";
}

export function togglePauseMenu() {
  if (Client.pauseOpen) closePauseMenu();
  else openPauseMenu();
}
