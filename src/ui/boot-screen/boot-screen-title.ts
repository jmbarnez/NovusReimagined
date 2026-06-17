import { sfxBlip } from "../../audio/procedural.js";
import { openSettingsOnBootMonitor } from "../settings/index.js";
import { showMultiplayerMenu } from "../title-multiplayer.js";
import { showSinglePlayerMenu } from "../title-single-player.js";
import { t } from "../../utils/i18n.js";
import { formatBuildLabel } from "../../data/version.js";
import { query, setHtml, onClick } from "../dom-helpers.js";
import { stopActiveProfileSessionTimer } from "../../data/profiles.js";
import { quitApplication } from "../../utils/app-exit.js";

/**
 * Boot Screen Title Controller
 *
 * Owns left-monitor title rendering + event binding.
 */

/** Bind title events in the left monitor. Idempotent: clones each button before attaching listeners. */
export function bindTitleScreenEvents(): void {
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) return;

  const bind = (id: string, handler: () => void) => {
    const el = monitor.querySelector(id) as HTMLElement | null;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    el.replaceWith(clone);
    onClick(clone, handler);
  };

  bind("#title-sp", () => {
    sfxBlip();
    showSinglePlayerMenu();
  });

  bind("#title-mp", () => {
    sfxBlip();
    showMultiplayerMenu();
  });

  bind("#title-settings", () => {
    sfxBlip();
    openSettingsOnBootMonitor(bindTitleScreenEvents);
  });

  bind("#title-exit", () => {
    sfxBlip();
    void quitApplication();
    window.open("about:blank", "_self");
    window.close();
  });
}

/** Restore default title monitor content and rebind events. */
export function restoreTitleScreen(): void {
  stopActiveProfileSessionTimer();
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) return;

  setHtml(monitor, `
    <div class="ld-title">NOVUS</div>
    <div class="ld-sep"></div>
    <div class="ld-sub">${t("title.initializing")}</div>
    <div class="ld-progress-bar">
      <div class="ld-progress-fill" style="width: 100%;"></div>
    </div>
    <div class="ld-status">${t("title.neuralPending")}<span class="ld-dots"></span></div>
    <div class="ld-menu-actions">
      <button type="button" id="title-sp" class="ld-btn-start">${t("title.singleplayer")}</button>
      <button type="button" id="title-mp" class="ld-btn-start ld-btn-secondary">${t("title.multiplayer")}</button>
      <div class="title-icon-row">
        <button type="button" id="title-settings" class="ld-btn-start ld-btn-settings title-settings-icon" aria-label="${t("title.settings")}">⚙</button>
        <button type="button" id="title-exit" class="ld-btn-start ld-btn-danger title-exit-icon" aria-label="${t("title.safeExit")}">⏻</button>
      </div>
    </div>
    <div class="title-build-label">${formatBuildLabel()}</div>
  `);

  bindTitleScreenEvents();
}
