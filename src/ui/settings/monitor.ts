import { sfxBlip } from "../../audio/procedural.js";
import { t } from "../../utils/i18n.js";
import { settingsContentHTML } from "./shell.js";
import { attachSettingsListeners } from "./listeners.js";
import { renderSettings } from "./render.js";

let _savedMonitorContent: string | null = null;
let _monitorRestore: (() => void) | null = null;

export function openSettingsOnBootMonitor(restoreFn: () => void): void {
  const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
  if (!monitor) return;
  if (monitor.classList.contains("monitor-settings-open")) return;

  _monitorRestore = restoreFn;
  _savedMonitorContent = monitor.innerHTML;
  monitor.classList.add("monitor-settings-open");

  const panel = document.createElement("div");
  panel.id = "settings-panel";
  panel.className = "eve-window monitor-settings-panel";
  panel.innerHTML = `
    <div class="eve-win-head">
      <span class="eve-win-title">${t("boot.settingsPanelTitle")}</span>
      <span class="eve-win-sub">${t("boot.settingsPanelSubtitle")}</span>
    </div>
    ${settingsContentHTML()}`;

  monitor.innerHTML = "";
  monitor.appendChild(panel);

  const bubble = document.createElement("div");
  bubble.id = "settings-tooltip-bubble";
  document.body.appendChild(bubble);

  attachSettingsListeners(panel, bubble);
  renderSettings();

  const exitBtn = panel.querySelector("#settings-exit") as HTMLButtonElement | null;
  if (exitBtn) {
    const backBtn = exitBtn.cloneNode(true) as HTMLButtonElement;
    backBtn.classList.remove("btn-exit");
    backBtn.classList.add("settings-back-btn");
    backBtn.textContent = t("common.back");
    backBtn.addEventListener("click", () => {
      sfxBlip();
      toggleSettingsMonitor();
    });
    exitBtn.replaceWith(backBtn);
  }
}

export function toggleSettingsMonitor(): void {
  const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
  if (!monitor) return;

  if (monitor.classList.contains("monitor-settings-open")) {
    monitor.classList.remove("monitor-settings-open");
    const bubble = document.getElementById("settings-tooltip-bubble");
    if (bubble) bubble.remove();

    if (_savedMonitorContent) {
      monitor.innerHTML = _savedMonitorContent;
      _savedMonitorContent = null;
    }

    if (_monitorRestore) {
      _monitorRestore();
      _monitorRestore = null;
    }
  }
}
