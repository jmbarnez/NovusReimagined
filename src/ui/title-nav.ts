import { sfxBlip } from "../audio/procedural.js";
import { Client } from "../state.js";
import { TITLE_BASE_W, TITLE_BASE_H } from "../constants.js";

export interface TitleMenuMount {
  root: HTMLElement;
  remove: () => void;
}

/** Fade out and remove a full-screen menu overlay. */
export function dismissMenuOverlay(overlay: HTMLElement, onDone?: () => void): void {
  overlay.classList.add("fade-out");
  overlay.style.pointerEvents = "none";
  window.setTimeout(() => {
    overlay.remove();
    onDone?.();
  }, 500);
}

export function mountTitleMenu(id: string, innerHtml: string): TitleMenuMount {
  const hud = document.getElementById("hud-overlay") as HTMLElement | null;
  if (hud) hud.style.display = "none";

  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.className = "title-screen title-subscreen";
  overlay.innerHTML = innerHtml;
  document.body.appendChild(overlay);

  const scaleRoot = overlay.querySelector(".title-ui-scale") as HTMLElement;
  const handleResize = () => {
    if (!document.body.contains(overlay)) {
      window.removeEventListener("resize", handleResize);
      return;
    }
    const scaleX = window.innerWidth / TITLE_BASE_W;
    const scaleY = window.innerHeight / TITLE_BASE_H;
    const maxScale = Math.min(scaleX, scaleY);
    const userScale = Client.settings?.uiScale ?? 1.0;
    const targetScale = (window.innerHeight / 1080) * 1.25 * userScale;
    const finalScale = Math.max(0.35, Math.min(maxScale * 0.95, targetScale));
    
    scaleRoot.style.transform = `scale(${finalScale})`;
  };

  handleResize();
  window.addEventListener("resize", handleResize);

  const originalRemove = overlay.remove.bind(overlay);
  overlay.remove = () => {
    window.removeEventListener("resize", handleResize);
    originalRemove();
  };

  return {
    root: overlay,
    remove: () => overlay.remove(),
  };
}

export function bindMenuBack(overlay: HTMLElement, onBack: () => void): void {
  overlay.querySelectorAll("[data-menu-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfxBlip();
      onBack();
    });
  });
}
