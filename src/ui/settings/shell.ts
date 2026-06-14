import "../styles/settings.css";
import { h, render } from "preact";
import { t } from "../../utils/i18n.js";
import { attachSettingsListeners } from "./listeners.js";
import { getElement, createElement, append } from "../dom-helpers.js";
import { SettingsContentView, SettingsPanelView } from "./shell-view.js";

export function settingsContentHTML(): string {
  const host = createElement("div");
  render(h(SettingsContentView, {}), host);
  const html = host.innerHTML;
  render(null, host);
  return html;
}

export function ensureSettingsUI() {
  if (getElement("settings-overlay")) return;

  const el = createElement("div");
  el.id = "settings-overlay";
  render(
    h(SettingsPanelView, {
      title: t("settings.title"),
      showChromeButtons: true,
    }),
    el,
  );
  append(document.body, el);

  const bubble = createElement("div");
  bubble.id = "settings-tooltip-bubble";
  append(document.body, bubble);

  attachSettingsListeners(el, bubble);
}
