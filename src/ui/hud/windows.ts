import { Client } from "../../state.js";
import { sfxBlip } from "../../audio/procedural.js";
import { WIN_EXPAND_ICON, WIN_CLOSE_ICON, WIN_RESET_ICON, setExpandButtonState, collapseWindowExpand } from "./window-chrome.js";
import { insertHTML, getElement, setStyle, toggleClass, setHtml, append, onClick, onMouseEnter, onMouseLeave } from "../dom-helpers.js";

const _windows = new Map<string, HTMLElement>();
const _closeCallbacks = new Map<string, () => void>();

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

  const hasInline = win.style.left && win.style.left !== "auto";
  if (!hasInline) {
    // If the window has never been dragged and it fits inside the viewport,
    // let CSS handle the centering or absolute offset responsively.
    if (wr.left >= 0 && wr.left <= maxX && wr.top >= 0 && wr.top <= maxY) {
      return;
    }
  }

  win.style.left = `${Math.max(0, Math.min(parseFloat(win.style.left) || wr.left, maxX))}px`;
  win.style.top = `${Math.max(0, Math.min(parseFloat(win.style.top) || wr.top, maxY))}px`;
  win.style.right = "auto";
}

export function bringToFront(win: HTMLElement) {
  Client.bridgeWindowZ += 1;
  win.style.zIndex = String(Client.bridgeWindowZ);
}

function makeWindowHTML(id: string, title: string): string {
  const classes: Record<string, string> = {
    cargo: "eve-window-cargo",
    missions: "eve-window-missions",
    skills: "eve-window-skills",
  };
  const cls = classes[id] || "";
  const resetBtn = id === "map" ? `<button type="button" class="eve-win-btn eve-win-reset" aria-label="Reset view" tabindex="-1">${WIN_RESET_ICON}</button>` : "";
  return `
    <div class="eve-window ${cls}" id="hud-win-${id}" style="display:none;position:fixed;">
      <div class="eve-win-head">
        <span class="eve-win-title">${title}</span>
        <span class="eve-win-sub"></span>
        <span style="flex:1"></span>
        <button type="button" class="eve-win-btn eve-win-expand" aria-label="Expand window" tabindex="-1">${WIN_EXPAND_ICON}</button>
        ${resetBtn}
        <button type="button" class="eve-win-btn eve-win-close" aria-label="Close window" tabindex="-1">${WIN_CLOSE_ICON}</button>
      </div>
      <div class="eve-win-body" id="hud-win-body-${id}"></div>
      <div class="eve-win-foot"></div>
    </div>`;
}

export function openHudWindow(id: string, title: string, contentEl: HTMLElement | string, onClose?: () => void) {
  if (onClose) {
    _closeCallbacks.set(id, onClose);
  } else {
    _closeCallbacks.delete(id);
  }
  let win = _windows.get(id);
  if (!win) {
    insertHTML(document.body, "beforeend", makeWindowHTML(id, title));
    win = getElement(`hud-win-${id}`)!;
    _windows.set(id, win);

    const head = win.querySelector(".eve-win-head") as HTMLElement;
    const closeBtn = win.querySelector(".eve-win-close") as HTMLElement;
    const expandBtn = win.querySelector(".eve-win-expand") as HTMLElement;
    const resetBtn = win.querySelector(".eve-win-reset") as HTMLElement;

    if (resetBtn) {
      onClick(resetBtn, (ev) => {
        ev.stopPropagation();
        Client.mapZoom = 1.0;
        Client.mapPanX = 0;
        Client.mapPanY = 0;
      });
    }

    onClick(head, (ev) => {
      const me = ev as MouseEvent;
      if (me.button !== 0) return;
      if ((me.target as HTMLElement).closest("button")) return;
      if (win!.classList.contains("is-expanded")) {
        collapseWindowExpand(win!, { capturePosition: true });
        const wr = win!.getBoundingClientRect();
        const headH = (win!.querySelector(".eve-win-head") as HTMLElement | null)?.offsetHeight ?? 26;
        setStyle(win!, { left: `${Math.max(0, me.clientX - wr.width / 2)}px`, top: `${Math.max(0, me.clientY - headH / 2)}px`, right: "auto" });
      }
      ev.preventDefault();
      bringToFront(win!);
      toggleClass(win!, "is-dragging", true);
      if (!win!.style.left || !win!.style.top) {
        const wr = win!.getBoundingClientRect();
        if (!win!.style.left) { setStyle(win!, { left: `${wr.left}px`, right: "auto" }); }
        if (!win!.style.top) setStyle(win!, { top: `${wr.top}px` });
      }
      const baseX = parseFloat(win!.style.left) || 0;
      const baseY = parseFloat(win!.style.top) || 0;
      const sx = me.clientX;
      const sy = me.clientY;
      const onMove = (mv: MouseEvent) => {
        setStyle(win!, { left: `${baseX + (mv.clientX - sx)}px`, top: `${baseY + (mv.clientY - sy)}px` });
        clampWindow(win!);
        emitWindowLayoutChanged();
      };
      const onUp = () => {
        toggleClass(win!, "is-dragging", false);
        emitWindowLayoutChanged();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
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
        const btn = w.querySelector(".eve-win-expand");
        if (btn) setExpandButtonState(btn as HTMLElement, false);
        if (w.dataset.prevLeft != null) {
          setStyle(w, { left: w.dataset.prevLeft, top: w.dataset.prevTop!, width: w.dataset.prevWidth!, height: w.dataset.prevHeight! });
        }
      });
      emitWindowLayoutChanged();
      if (expand) {
        bringToFront(win!);
        if (!win!.style.left || !win!.style.width) {
          const wr = win!.getBoundingClientRect();
          if (!win!.style.left) { setStyle(win!, { left: `${wr.left}px`, right: "auto" }); }
          if (!win!.style.top) setStyle(win!, { top: `${wr.top}px` });
          if (!win!.style.width) setStyle(win!, { width: `${wr.width}px` });
          if (!win!.style.height) setStyle(win!, { height: `${wr.height}px` });
        }
        win!.dataset.prevLeft = win!.style.left;
        win!.dataset.prevTop = win!.style.top;
        win!.dataset.prevWidth = win!.style.width;
        win!.dataset.prevHeight = win!.style.height;
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
window.addEventListener("resize", () => {
  _windows.forEach((win) => {
    if (win.style.display !== "none") {
      clampWindow(win);
      emitWindowLayoutChanged();
    }
  });
});

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
  return !!win && win.style.display !== "none";
}

export function closeTopmostWindow(): boolean {
  let topmostId: string | null = null;
  let topmost: HTMLElement | null = null;
  let topZ = -1;
  for (const [id, win] of _windows.entries()) {
    if (win.style.display === "none") continue;
    const z = parseInt(win.style.zIndex) || 0;
    if (z > topZ) { topZ = z; topmost = win; topmostId = id; }
  }
  if (topmost && topmostId) {
    closeHudWindow(topmostId);
    return true;
  }
  return false;
}
