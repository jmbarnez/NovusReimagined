import { INV_STATE } from "./state.js";
import { emit } from "../../events.js";

interface DragState {
  pane: HTMLElement;
  sourceSlot: number;
  itemId: string;
  ghost: HTMLElement;
  containerId: string;
}

let activeDrag: DragState | null = null;
let _dragAutoCleanup: ReturnType<typeof setTimeout> | null = null;

function removeAllGhosts() {
  for (const g of document.querySelectorAll(".inv-drag-ghost")) {
    g.parentNode?.removeChild(g);
  }
}

function createGhost(sourceCell: HTMLElement): HTMLElement {
  removeAllGhosts();
  const ghost = sourceCell.cloneNode(true) as HTMLElement;
  ghost.classList.add("inv-drag-ghost");
  ghost.style.position = "fixed";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "9999";
  ghost.style.opacity = "0.85";
  ghost.style.transform = "scale(1.05)";
  ghost.style.width = `${sourceCell.offsetWidth}px`;
  ghost.style.height = `${sourceCell.offsetHeight}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function getCellUnderPointer(clientX: number, clientY: number): HTMLElement | null {
  const ghost = activeDrag?.ghost;
  if (ghost) ghost.style.display = "none";
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (ghost) ghost.style.display = "";
  return el?.closest(".inv-grid-cell") as HTMLElement | null;
}

function computeVisualIndex(pane: HTMLElement, clientX: number, clientY: number): number {
  const cells = Array.from(pane.querySelectorAll(".inv-grid-cell"));
  if (cells.length === 0) return 0;

  const firstCell = cells[0] as HTMLElement;
  const cellW = firstCell.offsetWidth;
  const cellH = firstCell.offsetHeight;
  const gridWrap = pane.querySelector(".inv-grid-wrap") as HTMLElement;
  const gridRect = gridWrap.getBoundingClientRect();
  const gap = 4;
  const padding = 4;

  const relX = clientX - gridRect.left - padding;
  const relY = clientY - gridRect.top - padding;

  const firstTop = firstCell.offsetTop;
  const cols = cells.findIndex(c => (c as HTMLElement).offsetTop !== firstTop);
  const actualCols = cols === -1 ? cells.length : cols;

  const col = Math.max(0, Math.floor(relX / (cellW + gap)));
  const row = Math.max(0, Math.floor(relY / (cellH + gap)));
  return Math.max(0, Math.min(row * actualCols + col, cells.length));
}

function clearDragOver() {
  for (const el of document.querySelectorAll(".is-drag-over")) {
    el.classList.remove("is-drag-over");
  }
}

export function endDrag(): void {
  if (_dragAutoCleanup) {
    clearTimeout(_dragAutoCleanup);
    _dragAutoCleanup = null;
  }
  removeAllGhosts();
  activeDrag = null;
  for (const el of document.querySelectorAll(".is-dragging")) {
    el.classList.remove("is-dragging");
  }
  clearDragOver();
}

export function attachDragDropHandlers(pane: HTMLElement): void {
  pane.addEventListener("pointerdown", (e: Event) => {
    const ptr = e as PointerEvent;
    if (ptr.button !== 0) return;

    const htmlCell = (ptr.target as HTMLElement).closest(".inv-grid-cell") as HTMLElement | null;
    if (!htmlCell || !htmlCell.draggable) return;

    const itemId = htmlCell.dataset.item;
    const slotStr = htmlCell.dataset.slot;
    if (!itemId || slotStr === undefined) return;

    const sourceSlot = parseInt(slotStr, 10);
    if (Number.isNaN(sourceSlot)) return;

    ptr.preventDefault();

    const ghost = createGhost(htmlCell);
    activeDrag = { pane, sourceSlot, itemId, ghost, containerId: INV_STATE.selectedTreeId };
    htmlCell.classList.add("is-dragging");

    ghost.style.left = `${ptr.clientX - htmlCell.offsetWidth / 2}px`;
    ghost.style.top = `${ptr.clientY - htmlCell.offsetHeight / 2}px`;

    _dragAutoCleanup = setTimeout(() => endDrag(), 5000);
  });
}

window.addEventListener("pointermove", (e: PointerEvent) => {
  if (!activeDrag) return;
  activeDrag.ghost.style.left = `${e.clientX - activeDrag.ghost.offsetWidth / 2}px`;
  activeDrag.ghost.style.top = `${e.clientY - activeDrag.ghost.offsetHeight / 2}px`;

  const target = getCellUnderPointer(e.clientX, e.clientY);
  clearDragOver();
  if (target) target.classList.add("is-drag-over");
});

window.addEventListener("pointerup", (e: PointerEvent) => {
  if (!activeDrag) return;

  const target = getCellUnderPointer(e.clientX, e.clientY);
  if (target) {
    const targetSlotStr = target.dataset.slot;
    if (targetSlotStr !== undefined) {
      const targetSlot = parseInt(targetSlotStr, 10);
      if (!Number.isNaN(targetSlot) && targetSlot !== activeDrag.sourceSlot) {
        emit("inventory:grid-swap", {
          containerId: activeDrag.containerId,
          fromSlot: activeDrag.sourceSlot,
          toSlot: targetSlot,
        });
      }
    }
  } else {
    const visualIdx = computeVisualIndex(activeDrag.pane, e.clientX, e.clientY);
    emit("inventory:grid-insert", {
      containerId: activeDrag.containerId,
      fromSlot: activeDrag.sourceSlot,
      toVisualIndex: visualIdx,
    });
  }
  endDrag();
});

window.addEventListener("pointercancel", () => {
  endDrag();
});
