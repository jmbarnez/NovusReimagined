import { h, render } from "preact";
import { sfxBlip } from "../../audio/procedural.js";
import { t } from "../../utils/i18n.js";
import { attachSettingsListeners } from "./listeners.js";
import { renderSettings } from "./render.js";
import { SettingsPanelView } from "./shell-view.js";
import { getElement, query, createElement, setHtml, setText, append, onClick } from "../dom-helpers.js";

let _savedMonitorContent: string | null = null;
let _monitorRestore: (() => void) | null = null;

export function openSettingsOnBootMonitor(restoreFn: () => void): void {
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) return;
  if (monitor.classList.contains("monitor-settings-open")) return;

  _monitorRestore = restoreFn;
  _savedMonitorContent = monitor.innerHTML;
  monitor.classList.add("monitor-settings-open");

  setHtml(monitor, "");
  render(
    h(SettingsPanelView, {
      title: t("boot.settingsPanelTitle"),
      subtitle: t("boot.settingsPanelSubtitle"),
      className: "window monitor-settings-panel",
      showChromeButtons: false,
    }),
    monitor,
  );

  const panel = monitor.querySelector("#settings-panel") as HTMLElement | null;
  if (!panel) return;

  const bubble = createElement("div");
  bubble.id = "settings-tooltip-bubble";
  append(document.body, bubble);

  attachSettingsListeners(panel, bubble);
  renderSettings();

  const exitBtn = panel.querySelector("#settings-exit") as HTMLButtonElement | null;
  if (exitBtn) {
    const backBtn = exitBtn.cloneNode(true) as HTMLButtonElement;
    backBtn.classList.remove("btn-exit");
    backBtn.classList.add("settings-back-btn");
    setText(backBtn, t("common.back"));
    onClick(backBtn, () => {
      sfxBlip();
      toggleSettingsMonitor();
    });
    exitBtn.replaceWith(backBtn);
  }
}

export function toggleSettingsMonitor(): void {
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) return;

  if (monitor.classList.contains("monitor-settings-open")) {
    monitor.classList.remove("monitor-settings-open");
    const bubble = getElement("settings-tooltip-bubble");
    if (bubble) bubble.remove();
    render(null, monitor);

    if (_savedMonitorContent) {
      setHtml(monitor, _savedMonitorContent);
      _savedMonitorContent = null;
    }

    if (_monitorRestore) {
      _monitorRestore();
      _monitorRestore = null;
    }
  }
}
