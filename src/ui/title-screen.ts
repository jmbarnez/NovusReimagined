import "./styles/title-screen.css";
import { sfxBlip } from "../audio/procedural.js";
import { mountTitleMenu, dismissMenuOverlay } from "./title-nav.js";
import { showSinglePlayerMenu } from "./title-single-player.js";
import { showMultiplayerMenu } from "./title-multiplayer.js";
import { toggleSettings } from "./settings.js";

/** Root title screen — shows SINGLE PLAYER / MULTIPLAYER main menu. */
export function showTitleScreen(): void {
  const { root } = mountTitleMenu(
    "title-screen",
    `
    <div class="title-ui-scale">
      <div class="title-scaler">
        <div class="title-content">
          <button type="button" id="title-settings" class="title-settings-btn" aria-label="Open settings">⚙</button>
          <h1 class="title-main">NOVUS</h1>
          <p class="title-sub">NEURAL INTERFACE TERMINAL</p>
          <div class="title-menu-actions">
            <button type="button" id="title-sp" class="btn-start">SINGLE PLAYER</button>
            <button type="button" id="title-mp" class="btn-start btn-secondary">MULTIPLAYER</button>
          </div>
          <div class="title-footer">
            <p>SYSTEM STATUS: READY</p>
            <p>CONVERSION: v1.0.4-BETA</p>
          </div>
        </div>
      </div>
    </div>
    `,
  );

  root.querySelector("#title-sp")?.addEventListener("click", () => {
    sfxBlip();
    // Slide away the main menu, show single-player sub-menu, return here on back
    dismissMenuOverlay(root, () => showSinglePlayerMenu(() => showTitleScreen()));
  });

  root.querySelector("#title-mp")?.addEventListener("click", () => {
    sfxBlip();
    dismissMenuOverlay(root, () => showMultiplayerMenu(() => showTitleScreen()));
  });

  root.querySelector("#title-settings")?.addEventListener("click", () => {
    sfxBlip();
    toggleSettings();
  });
}
