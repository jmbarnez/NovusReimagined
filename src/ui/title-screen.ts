import "./styles/title-screen.css";
import { sfxConfirm, sfxBlip } from "../audio/procedural.js";
import { SAVE_KEY } from "../constants.js";
import { SHIPS } from "../data/ships.js";
import { G } from "../state.js";

export function showTitleScreen(onContinue: () => void, onNewGame: () => void) {
  const hud = document.getElementById("hud-overlay") as HTMLElement | null;
  if (hud) hud.style.display = "none";

  const overlay = document.createElement("div");
  overlay.id = "title-screen";

  // Check if save exists
  const rawSave = localStorage.getItem(SAVE_KEY);
  interface SaveData {
    shipId: string;
    sysIdx: number;
    level?: number;
    credits?: number;
  }
  let saveData: SaveData | null = null;
  if (rawSave) {
    try {
      saveData = JSON.parse(rawSave) as SaveData;
    } catch (e) {
      console.warn("[TitleScreen] Failed to parse save data:", e);
    }
  }

  if (saveData) {
    const shipName = SHIPS[saveData.shipId]?.name || "Class-I Scout";
    const systemName = G.GALAXY[saveData.sysIdx]?.name || "Unknown Sector";
    const levelVal = saveData.level ?? 1;
    const creditsVal = (saveData.credits ?? 0).toLocaleString();

    overlay.innerHTML = `
      <div class="title-content">
        <h1 class="title-main">NOVUS</h1>
        
        <div class="title-actions">
          <div class="continue-container">
            <button id="continue-btn" class="btn-start btn-continue">CONTINUE NEURAL LINK</button>
            <div class="save-meta-card">
              <div class="meta-glow"></div>
              <div class="meta-row">
                <span class="meta-label">LEVEL</span>
                <span class="meta-val highlight-yellow">Lv. ${levelVal}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">CREDITS</span>
                <span class="meta-val highlight-blue">${creditsVal} ¢</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">HULL CLASS</span>
                <span class="meta-val">${shipName}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">LOCATION</span>
                <span class="meta-val highlight-cyan">${systemName}</span>
              </div>
            </div>
          </div>

          <button id="new-game-btn" class="btn-start btn-secondary">INITIATE NEW LINK</button>
        </div>

        <div class="title-footer">
          <p>SYSTEM STATUS: READY</p>
          <p>CONVERSION: v1.0.4-BETA</p>
        </div>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div class="title-content">
        <h1 class="title-main">NOVUS</h1>
        <div class="title-actions">
          <button id="new-game-btn" class="btn-start">INITIATE NEURAL LINK</button>
        </div>
        <div class="title-footer">
          <p>SYSTEM STATUS: READY</p>
          <p>CONVERSION: v1.0.4-BETA</p>
        </div>
      </div>
    `;
  }

  document.body.appendChild(overlay);

  const newGameBtn = overlay.querySelector("#new-game-btn") as HTMLButtonElement | null;
  const continueBtn = overlay.querySelector("#continue-btn") as HTMLButtonElement | null;

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      sfxConfirm();
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.remove();
        onContinue();
      }, 800);
    });
  }

  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      if (saveData) {
        // Show high-tech confirmation overwrite modal
        showConfirmationModal(
          overlay,
          // onConfirm
          () => {
            overlay.classList.add("fade-out");
            setTimeout(() => {
              overlay.remove();
              onNewGame();
            }, 800);
          },
          // onCancel
          () => {}
        );
      } else {
        // Start new game directly
        sfxConfirm();
        overlay.classList.add("fade-out");
        setTimeout(() => {
          overlay.remove();
          onNewGame();
        }, 800);
      }
    });
  }
}

function showConfirmationModal(parent: HTMLElement, onConfirm: () => void, onCancel: () => void) {
  const modal = document.createElement("div");
  modal.className = "confirm-modal-overlay";
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <div class="modal-glow-amber"></div>
      <div class="modal-icon">⚠️</div>
      <h2 class="modal-title">NEURAL OVERWRITE WARNING</h2>
      <p class="modal-message">
        An established memory core was detected on this terminal. Overwriting will permanently sever previous neural linkages. This re-sequencing action is irreversible.
      </p>
      <div class="modal-buttons">
        <button id="modal-abort" class="btn-modal btn-abort">ABORT CONNECTION</button>
        <button id="modal-confirm" class="btn-modal btn-overwrite">CONFIRM OVERWRITE</button>
      </div>
    </div>
  `;
  parent.appendChild(modal);

  const abortBtn = modal.querySelector("#modal-abort") as HTMLButtonElement;
  const confirmBtn = modal.querySelector("#modal-confirm") as HTMLButtonElement;

  abortBtn.addEventListener("click", () => {
    sfxBlip();
    modal.classList.add("modal-fade-out");
    setTimeout(() => modal.remove(), 400);
    onCancel();
  });

  confirmBtn.addEventListener("click", () => {
    sfxConfirm();
    modal.classList.add("modal-fade-out");
    setTimeout(() => modal.remove(), 400);
    onConfirm();
  });
}
