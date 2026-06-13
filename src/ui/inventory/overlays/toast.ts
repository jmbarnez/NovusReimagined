import { getElement, setText, setStyle } from "../../dom-helpers.js";
import { ensureCargoToast, TOAST_ID } from "./elements.js";

let cargoToastTimeout: ReturnType<typeof setTimeout> | null = null;

/** Toast visible in HUD cargo window. */
export function showCargoToast(msg: string) {
  const toast = getElement(TOAST_ID);
  if (toast) {
    setText(toast, msg);
    setStyle(toast, { opacity: "1" });
  }

  if (cargoToastTimeout) clearTimeout(cargoToastTimeout);
  cargoToastTimeout = setTimeout(() => {
    const t = getElement(TOAST_ID);
    if (t) setStyle(t, { opacity: "0" });
  }, 2400);
}
