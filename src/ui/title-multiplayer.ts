import { sfxBlip } from "../audio/procedural.js";
import { pushMonitorMenu } from "./monitor-nav.js";
import { showPilotJoinScreen } from "./pilot-join.js";
import { bindTitleScreenEvents } from "./title-screen.js";
import { t } from "../utils/i18n.js";

export function showMultiplayerMenu(): void {
  const menuHtml = `
    <div class="multiplayer-menu-screen">
      <button type="button" class="multiplayer-back-btn" data-menu-back aria-label="${t("profile.back")}">← ${t("profile.back")}</button>
      <div class="ld-title multiplayer-menu-title">${t("title.multiplayer")}</div>
      <div class="ld-sep multiplayer-menu-sep"></div>
      <div class="ld-sub multiplayer-menu-sub">${t("multiplayer.subtitle")}</div>
      <div class="multiplayer-menu-grid">
        <button type="button" id="mp-find" class="multiplayer-menu-card multiplayer-menu-card--primary">
          <span class="multiplayer-menu-card-kicker">${t("multiplayer.find.kicker")}</span>
          <span class="multiplayer-menu-card-title">${t("multiplayer.find")}</span>
          <span class="multiplayer-menu-card-body">${t("multiplayer.find.body")}</span>
        </button>
        <button type="button" id="mp-join" class="multiplayer-menu-card">
          <span class="multiplayer-menu-card-kicker">${t("multiplayer.join.kicker")}</span>
          <span class="multiplayer-menu-card-title">${t("multiplayer.join")}</span>
          <span class="multiplayer-menu-card-body">${t("multiplayer.join.body")}</span>
        </button>
      </div>
    </div>
  `;

  pushMonitorMenu(menuHtml, (monitor) => {
    const openJoin = (autoScan: boolean): void => {
      showPilotJoinScreen({
        autoScan,
        mount: monitor,
        embedded: true,
        onClose: () => {},
        onBack: () => {},
      });
    };

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
