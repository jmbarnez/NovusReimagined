import { sfxBlip } from "../../audio/procedural.js";
import { setHtml, setStyle, getStyleProperty, setPosition, onClick, onMouseDown } from "../dom-helpers.js";

export const WIN_EXPAND_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="8" height="8" rx="1"/></svg>';

export const WIN_COLLAPSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="8" height="8" rx="1"/><line x1="1" y1="4" x2="9" y2="4"/></svg>';

export const WIN_CLOSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>';

export const WIN_RESET_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="5" cy="5" r="3.5"/><line x1="5" y1="2.5" x2="5" y2="5"/><line x1="5" y1="5" x2="7" y2="6.5"/></svg>';

/** Window chrome buttons should not steal keyboard focus or show native title tooltips. */
export function bindWindowChromeButton(btn: HTMLElement): void {
  onMouseDown(btn, (ev) => (ev as MouseEvent).preventDefault());
}

/** Simple dock-header title (no pop-out button since we use standalone windows only). */
export function buildDockHeaderHTML(title: string): string {
  return `<span class="hud-dock-title">${title}</span>`;
}

export function windowHeadButtonsHTML(): string {
  return `<span style="flex:1"></span>
        <button type="button" class="eve-win-btn eve-win-expand" aria-label="Expand window" tabindex="-1">${WIN_EXPAND_ICON}</button>
        <button type="button" class="eve-win-btn eve-win-close" aria-label="Close window" tabindex="-1">${WIN_CLOSE_ICON}</button>`;
}

export function setExpandButtonState(btn: HTMLElement, expanded: boolean): void {
  setHtml(btn, expanded ? WIN_COLLAPSE_ICON : WIN_EXPAND_ICON);
}

export interface WindowExpandOptions {
  /** Store and restore left/top for floating HUD windows. */
  capturePosition?: boolean;
  /** Toggle is-expanded only; sizing handled by CSS (e.g. settings modal). */
  embedded?: boolean;
  beforeExpand?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export function collapseWindowExpand(win: HTMLElement, options?: { capturePosition?: boolean; embedded?: boolean }): void {
  win.classList.remove("is-expanded");
  const expandBtn = win.querySelector(".eve-win-expand") as HTMLElement | null;
  if (expandBtn) setExpandButtonState(expandBtn, false);

  if (options?.embedded) {
    setStyle(win, { width: "", height: "" });
  } else if (options?.capturePosition && win.dataset.prevWidth != null) {
    setPosition(win, win.dataset.prevLeft ?? "", win.dataset.prevTop ?? "");
    setStyle(win, { width: win.dataset.prevWidth, height: win.dataset.prevHeight ?? "" });
  } else {
    setStyle(win, { width: "", height: "" });
  }

  delete win.dataset.prevLeft;
  delete win.dataset.prevTop;
  delete win.dataset.prevWidth;
  delete win.dataset.prevHeight;
}

export function expandWindow(win: HTMLElement, expandBtn: HTMLElement, options?: WindowExpandOptions): void {
  options?.beforeExpand?.();
  if (options?.embedded) {
    win.classList.add("is-expanded");
    setExpandButtonState(expandBtn, true);
    options?.onExpandChange?.(true);
    return;
  }

  const wr = win.getBoundingClientRect();

  if (options?.capturePosition) {
    const leftVal = getStyleProperty(win, "left");
    if (!leftVal || leftVal === "auto") {
      setPosition(win, `${wr.left}px`, getStyleProperty(win, "top"));
      setStyle(win, { right: "auto" });
    }
    const topVal = getStyleProperty(win, "top");
    if (!topVal) setPosition(win, getStyleProperty(win, "left"), `${wr.top}px`);
    win.dataset.prevLeft = getStyleProperty(win, "left");
    win.dataset.prevTop = getStyleProperty(win, "top");
  }

  const widthVal = getStyleProperty(win, "width");
  const heightVal = getStyleProperty(win, "height");
  if (!widthVal) setStyle(win, { width: `${wr.width}px` });
  if (!heightVal) setStyle(win, { height: `${wr.height}px` });
  win.dataset.prevWidth = getStyleProperty(win, "width");
  win.dataset.prevHeight = getStyleProperty(win, "height");

  win.classList.add("is-expanded");
  setExpandButtonState(expandBtn, true);
  options?.onExpandChange?.(true);
}

export function toggleWindowExpand(
  win: HTMLElement,
  expandBtn: HTMLElement,
  options?: WindowExpandOptions,
): boolean {
  const willExpand = !win.classList.contains("is-expanded");
  if (willExpand) {
    expandWindow(win, expandBtn, options);
  } else {
    collapseWindowExpand(win, {
      capturePosition: options?.capturePosition,
      embedded: options?.embedded,
    });
    options?.onExpandChange?.(false);
  }
  return willExpand;
}

export function resetWindowExpand(win: HTMLElement, options?: { capturePosition?: boolean; embedded?: boolean }): void {
  if (!win.classList.contains("is-expanded")) return;
  collapseWindowExpand(win, options);
}

export function attachSingleWindowExpand(
  win: HTMLElement,
  expandBtn: HTMLElement,
  options?: WindowExpandOptions,
): void {
  bindWindowChromeButton(expandBtn);
  onClick(expandBtn, (ev) => {
    (ev as MouseEvent).stopPropagation();
    sfxBlip();
    toggleWindowExpand(win, expandBtn, options);
    expandBtn.blur();
  });
}
