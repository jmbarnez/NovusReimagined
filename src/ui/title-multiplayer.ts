import { sfxBlip } from "../audio/procedural.js";
import { bindMenuBack, dismissMenuOverlay, mountTitleMenu } from "./title-nav.js";
import { showPilotHostScreen } from "./pilot-host.js";
import { showPilotJoinScreen } from "./pilot-join.js";

export function showMultiplayerMenu(onBack: () => void): void {
  const { root } = mountTitleMenu(
    "title-multiplayer",
    `
    <div class="title-ui-scale">
      <div class="title-scaler">
        <div class="title-content">
          <h1 class="title-main title-main--sub">MULTIPLAYER</h1>
          <p class="title-sub">REMOTE NEURAL RELAY</p>
          <div class="title-menu-actions">
            <button type="button" id="mp-host" class="btn-start">HOST SESSION</button>
            <button type="button" id="mp-find" class="btn-start btn-secondary">FIND &amp; JOIN</button>
            <button type="button" id="mp-join" class="btn-start btn-secondary">JOIN BY ADDRESS</button>
            <button type="button" data-menu-back class="btn-start btn-menu-back">BACK</button>
          </div>
        </div>
      </div>
    </div>
    `,
  );

  bindMenuBack(root, () => dismissMenuOverlay(root, onBack));

  const openJoin = (autoScan: boolean) => {
    root.style.pointerEvents = "none";
    showPilotJoinScreen({
      autoScan,
      onClose: () => {
        root.style.pointerEvents = "";
      },
      onBack: () => {
        root.style.pointerEvents = "";
      },
    });
  };

  root.querySelector("#mp-host")?.addEventListener("click", () => {
    sfxBlip();
    root.style.pointerEvents = "none";
    showPilotHostScreen(() => {
      root.style.pointerEvents = "";
    });
  });

  root.querySelector("#mp-find")?.addEventListener("click", () => {
    sfxBlip();
    openJoin(true);
  });

  root.querySelector("#mp-join")?.addEventListener("click", () => {
    sfxBlip();
    openJoin(false);
  });
}
