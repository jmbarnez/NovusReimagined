import { INV_STATE } from "./state.js";
import { moveItemInGrid } from "./grid-layout.js";

export interface DragDropHandlers {
  onRerender: () => void;
}

interface DragState {
  sourceSlot: number;
  itemId: string;
  ghost: HTMLElement;
}

let activeDrag: DragState | null = null;
let _handlers: DragDropHandlers | null = null;
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
  return el?.closest(".inv-grid-cell, .inv-grid-slot") as HTMLElement | null;
}

function clearDragOver() {
  for (const el of document.querySelectorAll(".is-drag-over")) {
    el.classList.remove("is-drag-over");
  }
}

function endDrag() {
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

export function attachDragDropHandlers(pane: HTMLElement, handlers: DragDropHandlers): void {
  _handlers = handlers;

  for (const cell of pane.querySelectorAll(".inv-grid-cell")) {
    const htmlCell = cell as HTMLElement;
    if (!htmlCell.draggable) continue;

    htmlCell.addEventListener("pointerdown", (e: Event) => {
      const ptr = e as PointerEvent;
      if (ptr.button !== 0) return;

      const itemId = htmlCell.dataset.item;
      const slotStr = htmlCell.dataset.slot;
      if (!itemId || slotStr === undefined) return;

      const sourceSlot = parseInt(slotStr, 10);
      if (Number.isNaN(sourceSlot)) return;

      ptr.preventDefault();

      const ghost = createGhost(htmlCell);
      activeDrag = { sourceSlot, itemId, ghost };
      htmlCell.classList.add("is-dragging");

      ghost.style.left = `${ptr.clientX - htmlCell.offsetWidth / 2}px`;
      ghost.style.top = `${ptr.clientY - htmlCell.offsetHeight / 2}px`;

      _dragAutoCleanup = setTimeout(() => endDrag(), 5000);
    });
  }
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
        moveItemInGrid(INV_STATE.selectedTreeId, activeDrag.sourceSlot, targetSlot);
        _handlers?.onRerender();
      }
    }
  }
  endDrag();
});

window.addEventListener("pointercancel", () => {
  endDrag();
});
