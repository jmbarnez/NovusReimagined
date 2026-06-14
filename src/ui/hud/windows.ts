import { Client } from "../../state.js";
import { sfxBlip } from "../../audio/procedural.js";
import { WIN_EXPAND_ICON, WIN_CLOSE_ICON, WIN_RESET_ICON, setExpandButtonState, collapseWindowExpand } from "./window-chrome.js";
import { insertHTML, getElement, setStyle, toggleClass, setHtml, append, onClick, onMouseDown, onMouseEnter, onMouseLeave, getStyleProperty, setPosition, onWindowResize, onWindowMouseMove, onWindowMouseUp } from "../dom-helpers.js";

const _windows = new Map<string, HTMLElement>();
const _closeCallbacks = new Map<string, () => void>();
let _cleanupHudResize: (() => void) | null = null;

export function getHudWindow(id: string): HTMLElement | null {
  return _windows.get(id) || null;
}

function emitWindowLayoutChanged(): void {
  window.dispatchEvent(new Event("hud:window-layout"));
}

function clampWindow(win: HTMLElement) {
  if (win.classList.contains("is-expanded")) return;
  const wr = win.getBoundingClientRect();
  if (wr.width === 0) return;
  const maxX = Math.max(0, window.innerWidth - wr.width);
  const maxY = Math.max(0, window.innerHeight - wr.height);

  const leftVal = getStyleProperty(win, "left");
  const hasInline = leftVal && leftVal !== "auto";
  if (!hasInline) {
    // If the window has never been dragged and it fits inside the viewport,
    // let CSS handle the centering or absolute offset responsively.
    if (wr.left >= 0 && wr.left <= maxX && wr.top >= 0 && wr.top <= maxY) {
      return;
    }
  }

  const newLeft = `${Math.max(0, Math.min(parseFloat(leftVal) || wr.left, maxX))}px`;
  const newTop = `${Math.max(0, Math.min(parseFloat(getStyleProperty(win, "top")) || wr.top, maxY))}px`;
  setPosition(win, newLeft, newTop);
  setStyle(win, { right: "auto" });
}

export function bringToFront(win: HTMLElement) {
  Client.bridgeWindowZ += 1;
  setStyle(win, { zIndex: String(Client.bridgeWindowZ) });
}

export function expandHudWindow(id: string): void {
  const win = _windows.get(id);
  if (!win) return;
  if (win.classList.contains("is-expanded")) {
    bringToFront(win);
    return;
  }
  _windows.forEach((w) => {
    if (w.classList.contains("is-expanded")) {
      collapseWindowExpand(w, { capturePosition: true });
    }
  });
  emitWindowLayoutChanged();
  const leftVal = getStyleProperty(win, "left");
  const widthVal = getStyleProperty(win, "width");
  if (!leftVal || !widthVal) {
    const wr = win.getBoundingClientRect();
    if (!leftVal) { setStyle(win, { left: `${wr.left}px`, right: "auto" }); }
    if (!getStyleProperty(win, "top")) setStyle(win, { top: `${wr.top}px` });
    if (!widthVal) setStyle(win, { width: `${wr.width}px` });
    if (!getStyleProperty(win, "height")) setStyle(win, { height: `${wr.height}px` });
  }
  win.dataset.prevLeft = getStyleProperty(win, "left");
  win.dataset.prevTop = getStyleProperty(win, "top");
  win.dataset.prevWidth = getStyleProperty(win, "width");
  win.dataset.prevHeight = getStyleProperty(win, "height");
  toggleClass(win, "is-expanded", true);
  const expandBtn = win.querySelector(".win-expand") as HTMLElement | null;
  if (expandBtn) setExpandButtonState(expandBtn, true);
  bringToFront(win);
  emitWindowLayoutChanged();
}

function makeWindowHTML(id: string, title: string): string {
  const classes: Record<string, string> = {
    cargo: "window-cargo",
    missions: "window-missions",
    skills: "window-skills",
    station: "window-station",
  };
  const cls = classes[id] || "";
  const resetBtn = id === "map" ? `<button type="button" class="win-btn win-reset" aria-label="Reset view" tabindex="-1">${WIN_RESET_ICON}</button>` : "";
  return `
    <div class="window ${cls}" id="hud-win-${id}" style="display:none;position:fixed;">
      <div class="win-head">
        <span class="win-title">${title}</span>
        <span class="win-sub"></span>
        <span style="flex:1"></span>
        <button type="button" class="win-btn win-expand" aria-label="Expand window" tabindex="-1">${WIN_EXPAND_ICON}</button>
        ${resetBtn}
        <button type="button" class="win-btn win-close" aria-label="Close window" tabindex="-1">${WIN_CLOSE_ICON}</button>
      </div>
      <div class="win-body" id="hud-win-body-${id}"></div>
      <div class="win-foot"></div>
    </div>`;
}

export function openHudWindow(id: string, title: string, contentEl: HTMLElement | string, onClose?: () => void) {
  if (onClose) {
    _closeCallbacks.set(id, onClose);
  } else {
    _closeCallbacks.delete(id);
  }
  let win = _windows.get(id);
  if (win && !win.isConnected) {
    _windows.delete(id);
    win = undefined;
  }
  if (!win) {
    insertHTML(document.body, "beforeend", makeWindowHTML(id, title));
    win = getElement(`hud-win-${id}`)!;
    _windows.set(id, win);

    const head = win.querySelector(".win-head") as HTMLElement;
    const closeBtn = win.querySelector(".win-close") as HTMLElement;
    const expandBtn = win.querySelector(".win-expand") as HTMLElement;
    const resetBtn = win.querySelector(".win-reset") as HTMLElement;

    if (resetBtn) {
      onClick(resetBtn, (ev) => {
        ev.stopPropagation();
        Client.mapZoom = 1.0;
        Client.mapPanX = 0;
        Client.mapPanY = 0;
      });
    }

    onMouseDown(head, (ev) => {
      const me = ev as MouseEvent;
      if (me.button !== 0) return;
      if ((me.target as HTMLElement).closest("button")) return;
      me.preventDefault();
      me.stopPropagation();
      if (win!.classList.contains("is-expanded")) {
        collapseWindowExpand(win!, { capturePosition: true });
        const wr = win!.getBoundingClientRect();
        const headH = (win!.querySelector(".win-head") as HTMLElement | null)?.offsetHeight ?? 26;
        setStyle(win!, { left: `${Math.max(0, me.clientX - wr.width / 2)}px`, top: `${Math.max(0, me.clientY - headH / 2)}px`, right: "auto" });
      }
      bringToFront(win!);
      toggleClass(win!, "is-dragging", true);
      const leftVal = getStyleProperty(win!, "left");
      const topVal = getStyleProperty(win!, "top");
      if (!leftVal || !topVal) {
        const wr = win!.getBoundingClientRect();
        if (!leftVal) { setStyle(win!, { left: `${wr.left}px`, right: "auto" }); }
        if (!topVal) setStyle(win!, { top: `${wr.top}px` });
      }
      const baseX = parseFloat(leftVal) || 0;
      const baseY = parseFloat(topVal) || 0;
      const sx = me.clientX;
      const sy = me.clientY;
      const onMove = (e: Event) => {
        const mv = e as MouseEvent;
        setStyle(win!, { left: `${baseX + (mv.clientX - sx)}px`, top: `${baseY + (mv.clientY - sy)}px` });
        clampWindow(win!);
        emitWindowLayoutChanged();
      };
      let removeMove: (() => void) | null = null;
      let removeUp: (() => void) | null = null;
      const onUp = () => {
        toggleClass(win!, "is-dragging", false);
        emitWindowLayoutChanged();
        if (removeMove) { removeMove(); removeMove = null; }
        if (removeUp) { removeUp(); removeUp = null; }
      };
      removeMove = onWindowMouseMove(onMove);
      removeUp = onWindowMouseUp(onUp);
    });

    onClick(closeBtn, (ev) => {
      ev.stopPropagation();
      closeHudWindow(id);
    });

    onClick(expandBtn, (ev) => {
      ev.stopPropagation();
      sfxBlip();
      const expand = !win!.classList.contains("is-expanded");
      _windows.forEach((w) => {
        toggleClass(w, "is-expanded", false);
        const btn = w.querySelector(".win-expand");
        if (btn) setExpandButtonState(btn as HTMLElement, false);
        if (w.dataset.prevLeft != null) {
          setStyle(w, { left: w.dataset.prevLeft, top: w.dataset.prevTop!, width: w.dataset.prevWidth!, height: w.dataset.prevHeight! });
        }
      });
      emitWindowLayoutChanged();
      if (expand) {
        bringToFront(win!);
        const leftVal2 = getStyleProperty(win!, "left");
        const widthVal2 = getStyleProperty(win!, "width");
        if (!leftVal2 || !widthVal2) {
          const wr = win!.getBoundingClientRect();
          if (!leftVal2) { setStyle(win!, { left: `${wr.left}px`, right: "auto" }); }
          if (!getStyleProperty(win!, "top")) setStyle(win!, { top: `${wr.top}px` });
          if (!widthVal2) setStyle(win!, { width: `${wr.width}px` });
          if (!getStyleProperty(win!, "height")) setStyle(win!, { height: `${wr.height}px` });
        }
        win!.dataset.prevLeft = getStyleProperty(win!, "left");
        win!.dataset.prevTop = getStyleProperty(win!, "top");
        win!.dataset.prevWidth = getStyleProperty(win!, "width");
        win!.dataset.prevHeight = getStyleProperty(win!, "height");
        toggleClass(win!, "is-expanded", true);
        setExpandButtonState(expandBtn as HTMLElement, true);
      }
      emitWindowLayoutChanged();
    });

    onClick(win, () => bringToFront(win!));
  }

  const body = getElement(`hud-win-body-${id}`);
  if (body && typeof contentEl === "string") {
    setHtml(body, contentEl);
  } else if (body && contentEl instanceof HTMLElement) {
    setHtml(body, "");
    append(body, contentEl);
  }

  setStyle(win, { display: "flex" });
  // Clamp immediately to handle small viewports gracefully on launch.
  // If it has no inline style and fits within the screen, clampWindow will return early and do nothing,
  // letting it center/position via bridge.css rules.
  clampWindow(win);
  bringToFront(win);
  emitWindowLayoutChanged();
}

// Keep all active dynamic windows inside visible viewport bounds on resize
_cleanupHudResize = onWindowResize(() => {
  _windows.forEach((win) => {
    if (getStyleProperty(win, "display") !== "none") {
      clampWindow(win);
      emitWindowLayoutChanged();
    }
  });
});

export function cleanupHudResize() {
  if (_cleanupHudResize) {
    _cleanupHudResize();
    _cleanupHudResize = null;
  }
}

export function closeHudWindow(id: string) {
  const win = _windows.get(id);
  if (win) {
    setStyle(win, { display: "none" });
    emitWindowLayoutChanged();
    const cb = _closeCallbacks.get(id);
    if (cb) {
      cb();
    }
  }
}

export function toggleHudWindow(id: string, title: string, contentEl: HTMLElement | string) {
  if (isOpen(id)) {
    closeHudWindow(id);
  } else {
    openHudWindow(id, title, contentEl);
  }
}

export function isOpen(id: string): boolean {
  const win = _windows.get(id);
  return !!win && getStyleProperty(win, "display") !== "none";
}

export function closeTopmostWindow(): boolean {
  let topmostId: string | null = null;
  let topmost: HTMLElement | null = null;
  let topZ = -1;
  for (const [id, win] of _windows.entries()) {
    if (getStyleProperty(win, "display") === "none") continue;
    const z = parseInt(getStyleProperty(win, "zIndex")) || 0;
    if (z > topZ) { topZ = z; topmost = win; topmostId = id; }
  }
  if (topmost && topmostId) {
    closeHudWindow(topmostId);
    return true;
  }
  return false;
}
