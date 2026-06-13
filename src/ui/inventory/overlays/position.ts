import { Client } from "../../../state.js";
import { setStyle, onDocumentMousedown } from "../../dom-helpers.js";
import { CTX_ROOT_ID } from "./elements.js";

export function clampCtxPosition(el: HTMLElement, clientX: number, clientY: number) {
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = clientX;
  let top = clientY;

  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (left + r.width > vw - pad) left = Math.max(pad, vw - r.width - pad);
    if (top + r.height > vh - pad) top = Math.max(pad, vh - r.height - pad);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    const scale = Client.settings?.uiScale ?? 1.0;
    setStyle(el, { left: `${left / scale}px`, top: `${top / scale}px` });
  });
}

let docDismissAttached = false;

export function ensureOutsideDismissHandlers(closeContextMenu: () => void) {
  if (docDismissAttached) return;
  docDismissAttached = true;
  onDocumentMousedown((ev) => {
    const t = (ev as MouseEvent).target as HTMLElement | null;
    if (!t) return;
    if (t.closest(`#${CTX_ROOT_ID}`) || t.closest(`#hud-win-item-info`)) return;
    closeContextMenu();
  });
}
