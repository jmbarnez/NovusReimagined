import "./styles/pause-menu.css";
import { Client, AppMode } from "../state.js";
import { savePlayer } from "../player/player-data.js";
import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { openSettings } from "./settings/index.js";
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
      <button type="button" id="pause-settings" class="pause-btn">${t("pause.settings")}</button>
      <button type="button" id="pause-exit" class="pause-btn pause-btn-exit">${t("pause.exit")}</button>
    </div>`;
  document.body.appendChild(el);

  on("ui:close-overlays", () => {
    el.style.display = "none";
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

  el.querySelector("#pause-settings")!.addEventListener("click", () => {
    sfxBlip();
    closePauseMenu();
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
    savePlayer();
    window.location.reload();
  });
}

export function openPauseMenu() {
  if (!Client.gameStarted || Client.mode !== AppMode.SPACE || Client.stationOpen) return;
  initPauseMenu();
  const el = document.getElementById("pause-overlay") as HTMLElement;
  el.style.display = "flex";
}

export function closePauseMenu() {
  const el = document.getElementById("pause-overlay");
  if (el) el.style.display = "none";
}

export function togglePauseMenu() {
  const el = document.getElementById("pause-overlay");
  if (el && el.style.display === "flex") closePauseMenu();
  else openPauseMenu();
}
