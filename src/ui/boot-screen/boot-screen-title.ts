import { sfxBlip } from "../../audio/procedural.js";
import { openSettingsOnBootMonitor } from "../settings/index.js";
import { showMultiplayerMenu } from "../title-multiplayer.js";
import { showSinglePlayerMenu } from "../title-single-player.js";

/**
 * Boot Screen Title Controller
 *
 * Owns left-monitor title rendering + event binding.
 */

/** Bind title events in the left monitor. */
export function bindTitleScreenEvents(): void {
  const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
  if (!monitor) return;

  monitor.querySelector("#title-sp")?.addEventListener("click", () => {
    sfxBlip();
    showSinglePlayerMenu();
  });

  monitor.querySelector("#title-mp")?.addEventListener("click", () => {
    sfxBlip();
    showMultiplayerMenu();
  });

  monitor.querySelector("#title-settings")?.addEventListener("click", () => {
    sfxBlip();
    openSettingsOnBootMonitor(bindTitleScreenEvents);
  });

  monitor.querySelector("#title-exit")?.addEventListener("click", () => {
    sfxBlip();
    if (!confirm("Safely exit Novus? Any unsaved progress will be lost.")) return;
    window.open("about:blank", "_self");
    window.close();
  });
}

/** Restore default title monitor content and rebind events. */
export function restoreTitleScreen(): void {
  const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
  if (!monitor) return;

  monitor.innerHTML = `
    <div class="ld-title">NOVUS</div>
    <div class="ld-sep"></div>
    <div class="ld-sub">Initializing neural interface</div>
    <div class="ld-progress-bar">
      <div class="ld-progress-fill" style="width: 100%;"></div>
    </div>
    <div class="ld-status">Neural link pending<span class="ld-dots"></span></div>
    <div class="ld-menu-actions">
      <button type="button" id="title-sp" class="ld-btn-start">SINGLE PLAYER</button>
      <button type="button" id="title-mp" class="ld-btn-start ld-btn-secondary">MULTIPLAYER</button>
      <button type="button" id="title-settings" class="ld-btn-start ld-btn-settings" aria-label="Open settings">⚙ SETTINGS</button>
      <button type="button" id="title-exit" class="ld-btn-start ld-btn-danger">SAFE EXIT</button>
    </div>
  `;

  bindTitleScreenEvents();
}
