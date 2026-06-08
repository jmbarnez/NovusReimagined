import { INV_STATE } from "./state.js";
import { getLayout, setLayout } from "./grid-layout.js";

export interface DragDropHandlers {
  onRerender: () => void;
}

export function attachDragDropHandlers(pane: HTMLElement, handlers: DragDropHandlers): void {
  const gridCells = pane.querySelectorAll(".inv-grid-cell[draggable='true']");

  for (const cell of gridCells) {
    cell.addEventListener("dragstart", (e: Event) => {
      console.log("dragstart fired", cell);
      const dragEvent = e as DragEvent;
      const itemId = (cell as HTMLElement).dataset.item;
      const slotStr = (cell as HTMLElement).dataset.slot;
      if (!itemId || slotStr === undefined) return;

      const slotIndex = parseInt(slotStr, 10);
      if (Number.isNaN(slotIndex)) return;

      dragEvent.dataTransfer?.setData("application/x-novus-inv-drag", JSON.stringify({ itemId, slotIndex }));
      dragEvent.dataTransfer!.effectAllowed = "move";
      (cell as HTMLElement).classList.add("is-dragging");
    });

    cell.addEventListener("dragend", () => {
      console.log("dragend fired");
      (cell as HTMLElement).classList.remove("is-dragging");
    });
  }

  pane.addEventListener("dragover", (e: Event) => {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    dragEvent.dataTransfer!.dropEffect = "move";

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

    const rawData = dragEvent.dataTransfer?.getData("application/x-novus-inv-drag");
    if (!rawData) return;

    try {
      const data = JSON.parse(rawData) as { itemId: string; slotIndex: number };
      const targetSlotStr = target.dataset.slot;
      if (!targetSlotStr) return;

      const targetSlot = parseInt(targetSlotStr, 10);
      if (Number.isNaN(targetSlot)) return;

      moveItemInGrid(INV_STATE.selectedTreeId, data.slotIndex, targetSlot);
      handlers.onRerender();
    } catch {
      // Ignore parse errors
    }
  });
}

function moveItemInGrid(containerId: string, fromIndex: number, toIndex: number): void {
  const layout = getLayout(containerId);
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= layout.positions.length) return;

  const positions = [...layout.positions];
  const [moved] = positions.splice(fromIndex, 1);
  const insertAt = Math.min(toIndex, positions.length);
  positions.splice(insertAt, 0, moved);

  const newPositions = positions.map((p, i) => ({ ...p, slotIndex: i }));
  setLayout(containerId, { ...layout, positions: newPositions, nextSlot: newPositions.length });
}
