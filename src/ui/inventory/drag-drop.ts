import { INV_STATE } from "./state.js";
import { emit } from "../../events.js";
import { queryAll, append, remove, setStyle, setPosition, onPointerDown, onWindowPointerMove, onWindowPointerUp, onWindowPointerCancel, getStyleProperty } from "../dom-helpers.js";

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
  for (const g of queryAll(".inv-drag-ghost")) {
    remove(g);
  }
}

function createGhost(sourceCell: HTMLElement): HTMLElement {
  removeAllGhosts();
  const ghost = sourceCell.cloneNode(true) as HTMLElement;
  ghost.classList.add("inv-drag-ghost");
  setStyle(ghost, { position: "fixed", pointerEvents: "none", zIndex: "9999", opacity: "0.85", transform: "scale(1.05)", width: `${sourceCell.offsetWidth}px`, height: `${sourceCell.offsetHeight}px` });
  append(document.body, ghost);
  return ghost;
}

function getCellUnderPointer(clientX: number, clientY: number, fallbackTarget?: EventTarget | null): HTMLElement | null {
  const ghost = activeDrag?.ghost;
  if (ghost) setStyle(ghost, { display: "none" });
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (ghost) setStyle(ghost, { display: "" });
  const hitCell = el?.closest(".inv-grid-cell") as HTMLElement | null;
  if (hitCell) return hitCell;
  return fallbackTarget instanceof HTMLElement
    ? fallbackTarget.closest(".inv-grid-cell") as HTMLElement | null
    : null;
}

function computeVisualIndex(pane: HTMLElement, clientX: number, clientY: number): number {
  const cells = Array.from(pane.querySelectorAll(".inv-grid-cell"));
  if (cells.length === 0) return 0;

  const firstCell = cells[0] as HTMLElement;
  const cellW = firstCell.offsetWidth;
  const cellH = firstCell.offsetHeight;
  const gridWrap = (pane.matches(".inv-grid-wrap") ? pane : pane.querySelector(".inv-grid-wrap")) as HTMLElement | null;
  if (!gridWrap) return 0;
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
  for (const el of queryAll(".is-drag-over")) {
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
  for (const el of queryAll(".is-dragging")) {
    el.classList.remove("is-dragging");
  }
  clearDragOver();
}

export function attachDragDropHandlers(pane: HTMLElement): void {
  onPointerDown(pane, (e: Event) => {
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

    setPosition(ghost, `${ptr.clientX - htmlCell.offsetWidth / 2}px`, `${ptr.clientY - htmlCell.offsetHeight / 2}px`);

    _dragAutoCleanup = setTimeout(() => endDrag(), 5000);
  });
}

onWindowPointerMove((e: Event) => {
  const ev = e as PointerEvent;
  if (!activeDrag) return;
  setPosition(activeDrag.ghost, `${ev.clientX - activeDrag.ghost.offsetWidth / 2}px`, `${ev.clientY - activeDrag.ghost.offsetHeight / 2}px`);

  const target = getCellUnderPointer(ev.clientX, ev.clientY, ev.target);
  clearDragOver();
  if (target) target.classList.add("is-drag-over");
});

onWindowPointerUp((e: Event) => {
  const ev = e as PointerEvent;
  if (!activeDrag) return;

  const target = getCellUnderPointer(ev.clientX, ev.clientY, ev.target);
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
    const visualIdx = computeVisualIndex(activeDrag.pane, ev.clientX, ev.clientY);
    emit("inventory:grid-insert", {
      containerId: activeDrag.containerId,
      fromSlot: activeDrag.sourceSlot,
      toVisualIndex: visualIdx,
    });
  }
  endDrag();
});

onWindowPointerCancel(() => {
  endDrag();
});
