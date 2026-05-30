import { sfxConfirm, sfxBlip } from "../audio/procedural.js";
import { SAVE_KEY } from "../constants.js";
import { SHIPS } from "../data/ships.js";
import { getState } from "../state-access.js";
import { bindMenuBack, dismissMenuOverlay, mountTitleMenu } from "./title-nav.js";
import { startNewGameWithProfile } from "./game-start.js";
import { restoreGameFromSave } from "../utils/restore-save.js";
import { enterSpaceMode } from "../game-loop.js";
import { logEvent } from "./hud-overlay.js";

function showOverwriteConfirm(parent: HTMLElement, onConfirm: () => void): void {
  const modal = document.createElement("div");
  modal.className = "confirm-modal-overlay";
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <div class="modal-glow-amber"></div>
      <div class="modal-icon">⚠️</div>
      <h2 class="modal-title">NEURAL OVERWRITE WARNING</h2>
      <p class="modal-message">
        An established memory core was detected. Starting a new link will permanently overwrite your save.
      </p>
      <div class="modal-buttons">
        <button type="button" id="modal-abort" class="btn-modal btn-abort">CANCEL</button>
        <button type="button" id="modal-confirm" class="btn-modal btn-overwrite">OVERWRITE</button>
      </div>
    </div>
  `;
  parent.appendChild(modal);
  modal.querySelector("#modal-abort")?.addEventListener("click", () => {
    sfxBlip();
    modal.remove();
  });
  modal.querySelector("#modal-confirm")?.addEventListener("click", () => {
    sfxConfirm();
    modal.remove();
    onConfirm();
  });
}

export function showSinglePlayerMenu(onBack: () => void): void {
  let saveMeta = "";
  let hasSave = false;
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    try {
      const save = JSON.parse(raw) as { shipId: string; sysIdx: number; level?: number; credits?: number };
      hasSave = true;
      const shipName = SHIPS[save.shipId]?.name || "Class-I Scout";
      const systemName = getState().GALAXY[save.sysIdx]?.name || "Unknown Sector";
      saveMeta = `
        <div class="save-meta-card save-meta-card--compact">
          <div class="meta-row">
            <span class="meta-label">LEVEL</span>
            <span class="meta-val highlight-yellow">Lv. ${save.level ?? 1}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">LOCATION</span>
            <span class="meta-val highlight-cyan">${systemName}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">HULL</span>
            <span class="meta-val">${shipName}</span>
          </div>
        </div>
      `;
    } catch {
      hasSave = false;
    }
  }

  const { root } = mountTitleMenu(
    "title-single-player",
    `
    <div class="title-ui-scale">
      <div class="title-scaler">
        <div class="title-content">
          <h1 class="title-main title-main--sub">SINGLE PLAYER</h1>
          <p class="title-sub">LOCAL NEURAL SIMULATION</p>
          <div class="title-menu-actions">
            ${hasSave ? `<button type="button" id="sp-continue" class="btn-start btn-continue">CONTINUE</button>${saveMeta}` : ""}
            <button type="button" id="sp-new" class="btn-start ${hasSave ? "btn-secondary" : ""}">NEW GAME</button>
            <button type="button" data-menu-back class="btn-start btn-menu-back">BACK</button>
          </div>
        </div>
      </div>
    </div>
    `,
  );

  bindMenuBack(root, () => {
    dismissMenuOverlay(root, onBack);
  });

  root.querySelector("#sp-continue")?.addEventListener("click", () => {
    sfxConfirm();
    dismissMenuOverlay(root, () => {
      restoreGameFromSave();
      enterSpaceMode();
      const sys = getState().GALAXY[getState().player.sysIdx];
      if (sys) {
        logEvent(`Neural link restored. System entry: ${sys.name} (SEC ${sys.security.toFixed(1)})`, "system");
      }
    });
  });

  root.querySelector("#sp-new")?.addEventListener("click", () => {
    const startNew = () => {
      dismissMenuOverlay(root, () => {
        startNewGameWithProfile(() => showSinglePlayerMenu(onBack));
      });
    };
    if (hasSave) {
      showOverwriteConfirm(root, startNew);
    } else {
      sfxConfirm();
      startNew();
    }
  });
}
