import { sfxBlip } from "../../audio/procedural.js";

export const WIN_EXPAND_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="8" height="8" rx="1"/></svg>';

export const WIN_COLLAPSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="8" height="8" rx="1"/><line x1="1" y1="4" x2="9" y2="4"/></svg>';

export const WIN_CLOSE_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>';

export const WIN_POPOUT_ICON =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="5" height="5" rx="0.5"/><path d="M4 3.5V2.5H8.5V7H7.5"/><path d="M6 4L8.5 1.5"/></svg>';

/** Window chrome buttons should not steal keyboard focus or show native title tooltips. */
export function bindWindowChromeButton(btn: HTMLElement): void {
  btn.addEventListener("mousedown", (ev) => ev.preventDefault());
}

export function panelPopoutButtonHTML(): string {
  return `<button type="button" class="eve-win-btn hud-panel-popout" aria-label="Pop out" tabindex="-1">${WIN_POPOUT_ICON}</button>`;
}

export function windowHeadButtonsHTML(): string {
  return `<span style="flex:1"></span>
        <button type="button" class="eve-win-btn eve-win-expand" aria-label="Expand window" tabindex="-1">${WIN_EXPAND_ICON}</button>
        <button type="button" class="eve-win-btn eve-win-close" aria-label="Close window" tabindex="-1">${WIN_CLOSE_ICON}</button>`;
}

export function setExpandButtonState(btn: HTMLElement, expanded: boolean): void {
  btn.innerHTML = expanded ? WIN_COLLAPSE_ICON : WIN_EXPAND_ICON;
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
    win.style.width = "";
    win.style.height = "";
  } else if (options?.capturePosition && win.dataset.prevWidth != null) {
    win.style.left = win.dataset.prevLeft ?? "";
    win.style.top = win.dataset.prevTop ?? "";
    win.style.width = win.dataset.prevWidth;
    win.style.height = win.dataset.prevHeight ?? "";
  } else {
    win.style.width = "";
    win.style.height = "";
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
    if (!win.style.left || win.style.left === "auto") {
      win.style.left = `${wr.left}px`;
      win.style.right = "auto";
    }
    if (!win.style.top) win.style.top = `${wr.top}px`;
    win.dataset.prevLeft = win.style.left;
    win.dataset.prevTop = win.style.top;
  }

  if (!win.style.width) win.style.width = `${wr.width}px`;
  if (!win.style.height) win.style.height = `${wr.height}px`;
  win.dataset.prevWidth = win.style.width;
  win.dataset.prevHeight = win.style.height;

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
  expandBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfxBlip();
    toggleWindowExpand(win, expandBtn, options);
    expandBtn.blur();
  });
}
