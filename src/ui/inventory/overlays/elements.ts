import { getElement, createElement, append, setStyle } from "../../dom-helpers.js";

export const CTX_ROOT_ID = "inv-ctx-root";
export const INFO_WINDOW_ID = "item-info";
export const TOAST_ID = "inv-cargo-toast";
export const HOVER_TIP_ID = "inv-hover-tip";

export function ensureInvCtxRoot(): HTMLElement {
  let el = getElement(CTX_ROOT_ID);
  if (!el) {
    el = createElement("div");
    el.id = CTX_ROOT_ID;
    el.setAttribute("role", "presentation");
    setStyle(el, { display: "none", position: "fixed", left: "0", top: "0", zIndex: "9200", pointerEvents: "none" });
    append(document.body, el);
  }
  return el as HTMLElement;
}

export function ensureCargoToast(): HTMLElement {
  let el = getElement(TOAST_ID);
  if (!el) {
    el = createElement("div", "inv-toast-float");
    el.id = TOAST_ID;
    setStyle(el, { opacity: "0" });
    append(document.body, el);
  }
  return el as HTMLElement;
}

export function ensureInvHoverTip(): HTMLElement {
  let el = getElement(HOVER_TIP_ID);
  if (!el) {
    el = createElement("div", "inv-hover-tip");
    el.id = HOVER_TIP_ID;
    setStyle(el, { display: "none" });
    append(document.body, el);
  }
  return el as HTMLElement;
}
