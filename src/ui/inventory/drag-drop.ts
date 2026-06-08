import { INV_STATE } from "./state.js";
import { moveItemInGrid } from "./grid-layout.js";

const DRAG_MIME = "text/plain";

export interface DragDropHandlers {
  onRerender: () => void;
}

export function attachDragDropHandlers(pane: HTMLElement, handlers: DragDropHandlers): void {
  for (const cell of pane.querySelectorAll(".inv-grid-cell")) {
    const htmlCell = cell as HTMLElement;
    if (!htmlCell.draggable) continue;

    htmlCell.addEventListener("dragstart", (e: Event) => {
      const dragEvent = e as DragEvent;
      const itemId = htmlCell.dataset.item;
      const slotStr = htmlCell.dataset.slot;
      if (!itemId || slotStr === undefined) return;

      const slotIndex = parseInt(slotStr, 10);
      if (Number.isNaN(slotIndex)) return;

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.setData(DRAG_MIME, JSON.stringify({ itemId, slotIndex }));
        dragEvent.dataTransfer.effectAllowed = "move";
      }
      htmlCell.classList.add("is-dragging");
    });

    htmlCell.addEventListener("dragend", () => {
      htmlCell.classList.remove("is-dragging");
    });
  }

  // dragenter is required in some browsers to enable dropping
  pane.addEventListener("dragenter", (e: Event) => {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    if (dragEvent.dataTransfer) {
      dragEvent.dataTransfer.dropEffect = "move";
    }
  });

  pane.addEventListener("dragover", (e: Event) => {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    if (dragEvent.dataTransfer) {
      dragEvent.dataTransfer.dropEffect = "move";
    }

    const target = (e.target as HTMLElement).closest(".inv-grid-cell, .inv-grid-slot") as HTMLElement | null;
    if (target) target.classList.add("is-drag-over");
  });

  pane.addEventListener("dragleave", (e: Event) => {
    const target = (e.target as HTMLElement).closest(".inv-grid-cell, .inv-grid-slot") as HTMLElement | null;
    if (!target) return;
    const related = (e as DragEvent).relatedTarget as HTMLElement | null;
    if (related && target.contains(related)) return;
    target.classList.remove("is-drag-over");
  });

  pane.addEventListener("drop", (e: Event) => {
    const target = (e.target as HTMLElement).closest(".inv-grid-cell, .inv-grid-slot") as HTMLElement | null;
    if (!target) return;

    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    target.classList.remove("is-drag-over");

    const rawData = dragEvent.dataTransfer?.getData(DRAG_MIME);
    if (!rawData) return;

    try {
      const data = JSON.parse(rawData) as { itemId: string; slotIndex: number };
      const targetSlotStr = target.dataset.slot;
      if (targetSlotStr === undefined) return;

      const targetSlot = parseInt(targetSlotStr, 10);
      if (Number.isNaN(targetSlot)) return;

      moveItemInGrid(INV_STATE.selectedTreeId, data.slotIndex, targetSlot);
      handlers.onRerender();
    } catch {
      // Ignore parse errors
    }
  });
}
