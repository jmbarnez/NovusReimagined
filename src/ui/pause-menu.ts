import "./styles/pause-menu.css";
import { Client, AppMode } from "../state.js";
import { savePlayer } from "../player/player-data.js";
import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { openSettings } from "./settings/index.js";
import { t } from "../utils/i18n.js";
import { on } from "../events.js";
import { getElement, createElement, setHtml, setStyle, setText, append, onClick, getStyleProperty } from "./dom-helpers.js";

export function initPauseMenu() {
  if (getElement("pause-overlay")) return;

  const el = createElement("div");
  el.id = "pause-overlay";
  setHtml(el, `
    <div class="pause-panel">
      <h2 class="pause-title">${t("pause.title")}</h2>
      <button type="button" id="pause-resume" class="pause-btn pause-btn-primary">${t("pause.resume")}</button>
      <button type="button" id="pause-save" class="pause-btn">${t("pause.save")}</button>
      <button type="button" id="pause-settings" class="pause-btn">${t("pause.settings")}</button>
      <button type="button" id="pause-exit" class="pause-btn pause-btn-exit">${t("pause.exit")}</button>
    </div>`);
  append(document.body, el);

  on("ui:close-overlays", () => {
    setStyle(el, { display: "none" });
  });

  const resumeBtn = el.querySelector("#pause-resume");
  if (resumeBtn) onClick(resumeBtn, () => {
    sfxBlip();
    closePauseMenu();
  });

  const saveBtn = el.querySelector("#pause-save");
  if (saveBtn) onClick(saveBtn, () => {
    sfxConfirm();
    savePlayer();
    const btn = saveBtn as HTMLButtonElement;
    setText(btn, t("common.saved"));
    btn.disabled = true;
    setTimeout(() => {
      setText(btn, t("pause.save"));
      btn.disabled = false;
    }, 1200);
  });

  const settingsBtn = el.querySelector("#pause-settings");
  if (settingsBtn) onClick(settingsBtn, () => {
    sfxBlip();
    closePauseMenu();
    openSettings();
  });

  const exitBtn = el.querySelector("#pause-exit");
  if (exitBtn) onClick(exitBtn, () => {
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
  const overlay = getElement("pause-overlay");
  if (overlay) setStyle(overlay, { display: "flex" });
}

export function closePauseMenu() {
  const el = getElement("pause-overlay");
  if (el) setStyle(el, { display: "none" });
}

export function togglePauseMenu() {
  const el = getElement("pause-overlay");
  if (el && getStyleProperty(el, "display") === "flex") closePauseMenu();
  else openPauseMenu();
}
