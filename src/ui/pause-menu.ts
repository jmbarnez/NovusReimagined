import "./styles/pause-menu.css";
import { h, render } from "preact";
import { Client, AppMode } from "../state.js";
import { savePlayer } from "../player/player-data.js";
import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { openSettings } from "./settings/index.js";
import { t } from "../utils/i18n.js";
import { on } from "../events.js";
import { getElement, createElement, setStyle, append, getStyleProperty } from "./dom-helpers.js";
import { PauseMenuView } from "./pause-menu-view.js";

export function initPauseMenu() {
  if (getElement("pause-overlay")) return;

  const el = createElement("div");
  el.id = "pause-overlay";
  append(document.body, el);

  on("ui:close-overlays", () => {
    setStyle(el, { display: "none" });
  });

  render(
    h(PauseMenuView, {
      onResume: () => {
        sfxBlip();
        closePauseMenu();
      },
      onSave: () => {
        sfxConfirm();
        savePlayer();
      },
      onSettings: () => {
        sfxBlip();
        closePauseMenu();
        openSettings();
      },
      onExit: () => {
        sfxBlip();
        if (!confirm(t("pause.confirmExit"))) return;
        savePlayer();
        window.location.reload();
      },
    }),
    el
  );
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
