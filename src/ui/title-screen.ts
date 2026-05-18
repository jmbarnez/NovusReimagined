import "./styles/title-screen.css";
import { sfxConfirm } from "../audio/procedural.js";

export function showTitleScreen(onStart: () => void) {
  const hud = document.getElementById("hud-overlay") as HTMLElement | null;
  if (hud) hud.style.display = "none";

  const overlay = document.createElement("div");
  overlay.id = "title-screen";
  overlay.innerHTML = `
    <div class="title-content">
      <h1 class="title-main">NOVUS</h1>
      <div class="title-actions">
        <button id="start-btn" class="btn-start">INITIATE NEURAL LINK</button>
      </div>
      <div class="title-footer">
        <p>SYSTEM STATUS: READY</p>
        <p>CONVERSION: v1.0.4-BETA</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const startBtn = overlay.querySelector("#start-btn") as HTMLButtonElement;
  startBtn.addEventListener("click", () => {
    sfxConfirm();
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.remove();
      onStart();
    }, 800);
  });
}
