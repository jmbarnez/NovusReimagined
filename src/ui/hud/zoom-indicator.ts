import { createElement, remove } from "../dom-helpers.js";

let _el: HTMLElement | null = null;
let _hideTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a transient zoom-level badge near the cursor.
 * Re-uses the same element if already visible, resetting the fade timer.
 */
export function showZoomIndicator(zoom: number, clientX: number, clientY: number): void {
  if (!_el) {
    _el = createElement("div", "zoom-indicator");
    document.body.appendChild(_el);
  }

  const pct = Math.round(zoom * 100);
  _el.textContent = `${pct}%`;

  // Position slightly above/right of cursor so it doesn't block the target
  const x = clientX + 14;
  const y = clientY - 28;
  _el.style.left = `${x}px`;
  _el.style.top = `${y}px`;

  // Reset fade
  _el.classList.remove("fading");

  if (_hideTimer) clearTimeout(_hideTimer);
  _hideTimer = setTimeout(() => {
    if (_el) _el.classList.add("fading");
    setTimeout(() => {
      if (_el) {
        remove(_el);
        _el = null;
      }
    }, 350);
  }, 1000);
}
