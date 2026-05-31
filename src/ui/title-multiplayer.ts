import { sfxBlip } from "../audio/procedural.js";
import { pushMonitorMenu } from "./monitor-nav.js";
import { showPilotHostScreen } from "./pilot-host.js";
import { showPilotJoinScreen } from "./pilot-join.js";
import { bindTitleScreenEvents } from "./title-screen.js";

export function showMultiplayerMenu(): void {
  const menuHtml = `
    <div class="ld-title" style="font-size: clamp(32px, 4vw, 56px);">MULTIPLAYER</div>
    <div class="ld-sep"></div>
    <div class="ld-sub">REMOTE NEURAL RELAY</div>
    <div class="ld-menu-actions">
      <button type="button" id="mp-host" class="ld-btn-start">HOST SESSION</button>
      <button type="button" id="mp-find" class="ld-btn-start ld-btn-secondary">FIND &amp; JOIN</button>
      <button type="button" id="mp-join" class="ld-btn-start ld-btn-secondary">JOIN BY ADDRESS</button>
      <button type="button" data-menu-back class="ld-btn-start ld-btn-secondary">BACK</button>
    </div>
  `;

  pushMonitorMenu(menuHtml, (monitor) => {
    const openJoin = (autoScan: boolean) => {
      const loading = document.getElementById("loading");
      if (loading) loading.style.pointerEvents = "none";
      showPilotJoinScreen({
        autoScan,
        onClose: () => {
          if (loading) loading.style.pointerEvents = "";
        },
        onBack: () => {
          if (loading) loading.style.pointerEvents = "";
        },
      });
    };

    monitor.querySelector("#mp-host")?.addEventListener("click", () => {
      sfxBlip();
      const loading = document.getElementById("loading");
      if (loading) loading.style.pointerEvents = "none";
      showPilotHostScreen(() => {
        if (loading) loading.style.pointerEvents = "";
      });
    });

    monitor.querySelector("#mp-find")?.addEventListener("click", () => {
      sfxBlip();
      openJoin(true);
    });

    monitor.querySelector("#mp-join")?.addEventListener("click", () => {
      sfxBlip();
      openJoin(false);
    });
  }, bindTitleScreenEvents);
}
