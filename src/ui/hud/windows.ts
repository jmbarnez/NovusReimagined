import { Client } from "../../state.js";
import { sfxBlip } from "../../audio/procedural.js";

const _windows = new Map<string, HTMLElement>();

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

function bringToFront(win: HTMLElement) {
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
  return `
    <div class="eve-window ${cls}" id="hud-win-${id}" style="display:none;position:fixed;">
      <div class="eve-win-head">
        <span class="eve-win-title">${title}</span>
        <span class="eve-win-sub"></span>
        <span style="flex:1"></span>
        <button type="button" class="eve-win-btn eve-win-expand" title="Expand">▢</button>
        <button type="button" class="eve-win-btn eve-win-close" title="Close">✕</button>
      </div>
      <div class="eve-win-body" id="hud-win-body-${id}"></div>
      <div class="eve-win-foot"></div>
    </div>`;
}

export function openHudWindow(id: string, title: string, contentEl: HTMLElement | string) {
  let win = _windows.get(id);
  if (!win) {
    document.body.insertAdjacentHTML("beforeend", makeWindowHTML(id, title));
    win = document.getElementById(`hud-win-${id}`)!;
    _windows.set(id, win);

    const head = win.querySelector(".eve-win-head") as HTMLElement;
    const closeBtn = win.querySelector(".eve-win-close") as HTMLElement;
    const expandBtn = win.querySelector(".eve-win-expand") as HTMLElement;

    head.addEventListener("mousedown", (ev) => {
      if ((ev as MouseEvent).button !== 0) return;
      if ((ev.target as HTMLElement).closest("button") || win!.classList.contains("is-expanded")) return;
      ev.preventDefault();
      bringToFront(win!);
      win!.classList.add("is-dragging");
      if (!win!.style.left || !win!.style.top) {
        const wr = win!.getBoundingClientRect();
        if (!win!.style.left) { win!.style.left = `${wr.left}px`; win!.style.right = "auto"; }
        if (!win!.style.top) win!.style.top = `${wr.top}px`;
      }
      const baseX = parseFloat(win!.style.left) || 0;
      const baseY = parseFloat(win!.style.top) || 0;
      const sx = (ev as MouseEvent).clientX;
      const sy = (ev as MouseEvent).clientY;
      const onMove = (mv: MouseEvent) => {
        win!.style.left = `${baseX + (mv.clientX - sx)}px`;
        win!.style.top = `${baseY + (mv.clientY - sy)}px`;
        clampWindow(win!);
      };
      const onUp = () => {
        win!.classList.remove("is-dragging");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });

    closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeHudWindow(id);
    });

    expandBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      sfxBlip();
      const expand = !win!.classList.contains("is-expanded");
      _windows.forEach((w) => {
        w.classList.remove("is-expanded");
        const btn = w.querySelector(".eve-win-expand");
        if (btn) btn.textContent = "▢";
        if (w.dataset.prevLeft != null) {
          w.style.left = w.dataset.prevLeft;
          w.style.top = w.dataset.prevTop!;
          w.style.width = w.dataset.prevWidth!;
          w.style.height = w.dataset.prevHeight!;
        }
      });
      if (expand) {
        bringToFront(win!);
        if (!win!.style.left || !win!.style.width) {
          const wr = win!.getBoundingClientRect();
          if (!win!.style.left) { win!.style.left = `${wr.left}px`; win!.style.right = "auto"; }
          if (!win!.style.top) win!.style.top = `${wr.top}px`;
          if (!win!.style.width) win!.style.width = `${wr.width}px`;
          if (!win!.style.height) win!.style.height = `${wr.height}px`;
        }
        win!.dataset.prevLeft = win!.style.left;
        win!.dataset.prevTop = win!.style.top;
        win!.dataset.prevWidth = win!.style.width;
        win!.dataset.prevHeight = win!.style.height;
        win!.classList.add("is-expanded");
        (expandBtn as HTMLElement).textContent = "▣";
      }
    });

    win.addEventListener("mousedown", () => bringToFront(win!));
  }

  const body = document.getElementById(`hud-win-body-${id}`);
  if (body && typeof contentEl === "string") {
    body.innerHTML = contentEl;
  } else if (body && contentEl instanceof HTMLElement) {
    body.innerHTML = "";
    body.appendChild(contentEl);
  }

  win.style.display = "flex";
  // Clamp immediately to handle small viewports gracefully on launch.
  // If it has no inline style and fits within the screen, clampWindow will return early and do nothing,
  // letting it center/position via bridge.css rules.
  clampWindow(win);
  bringToFront(win);
}

// Keep all active dynamic windows inside visible viewport bounds on resize
window.addEventListener("resize", () => {
  _windows.forEach((win) => {
    if (win.style.display !== "none") {
      clampWindow(win);
    }
  });
});

export function closeHudWindow(id: string) {
  const win = _windows.get(id);
  if (win) {
    win.style.display = "none";
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
  let topmost: HTMLElement | null = null;
  let topZ = -1;
  for (const win of _windows.values()) {
    if (win.style.display === "none") continue;
    const z = parseInt(win.style.zIndex) || 0;
    if (z > topZ) { topZ = z; topmost = win; }
  }
  if (topmost) {
    topmost.style.display = "none";
    return true;
  }
  return false;
}
