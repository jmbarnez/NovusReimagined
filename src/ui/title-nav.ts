import { sfxBlip } from "../audio/procedural.js";
import { Client } from "../state.js";
import { TITLE_BASE_W, TITLE_BASE_H } from "../constants.js";
import { getElement, createElement, setHtml, setStyle, append, onClick, onWindowResize } from "./dom-helpers.js";

export interface TitleMenuMount {
  root: HTMLElement;
  remove: () => void;
}

/** Fade out and remove a full-screen menu overlay. */
export function dismissMenuOverlay(overlay: HTMLElement, onDone?: () => void): void {
  overlay.classList.add("fade-out");
  setStyle(overlay, { pointerEvents: "none" });
  window.setTimeout(() => {
    overlay.remove();
    onDone?.();
  }, 500);
}

export function mountTitleMenu(id: string, innerHtml: string): TitleMenuMount {
  const hud = getElement("hud-overlay");
  if (hud) setStyle(hud, { display: "none" });

  const overlay = createElement("div", "title-screen title-subscreen");
  overlay.id = id;
  setHtml(overlay, innerHtml);
  append(document.body, overlay);

  const scaleRoot = overlay.querySelector(".title-ui-scale") as HTMLElement;
  const handleResize = () => {
    if (!document.body.contains(overlay)) {
      removeResize();
      return;
    }
    const scaleX = window.innerWidth / TITLE_BASE_W;
    const scaleY = window.innerHeight / TITLE_BASE_H;
    const maxScale = Math.min(scaleX, scaleY);
    const userScale = Client.settings?.uiScale ?? 1.0;
    const targetScale = (window.innerHeight / 1080) * 1.25 * userScale;
    const finalScale = Math.max(0.35, Math.min(maxScale * 0.95, targetScale));

    setStyle(scaleRoot, { transform: `scale(${finalScale})` });

    const settingsBtn = overlay.querySelector(".title-settings-btn") as HTMLElement | null;
    if (settingsBtn) {
      setStyle(settingsBtn, { transform: `scale(${finalScale})`, transformOrigin: "top right" });
    }
  };

  handleResize();
  const removeResize = onWindowResize(handleResize);

  const originalRemove = overlay.remove.bind(overlay);
  overlay.remove = () => {
    removeResize();
    originalRemove();
  };

  return {
    root: overlay,
    remove: () => overlay.remove(),
  };
}

export function bindMenuBack(overlay: HTMLElement, onBack: () => void): void {
  overlay.querySelectorAll("[data-menu-back]").forEach((btn) => {
    onClick(btn, () => {
      sfxBlip();
      onBack();
    });
  });
}
