import { describe, it, expect, beforeEach, vi } from "vitest";
import { attachDragDropHandlers, endDrag } from "../src/ui/inventory/drag-drop.js";
import { INV_STATE } from "../src/ui/inventory/state.js";
import { clearLayout } from "../src/ui/inventory/grid-layout.js";
import { on, emit } from "../src/events.js";

describe("drag-drop", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    endDrag();
    clearLayout("shipCargo");
    INV_STATE.selectedTreeId = "shipCargo";
  });

  function createPaneWithCells(itemIds: string[]): HTMLElement {
    const pane = document.createElement("div");
    pane.className = "inv-grid-wrap";
    for (let i = 0; i < itemIds.length; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-grid-cell";
      cell.draggable = true;
      cell.dataset.item = itemIds[i];
      cell.dataset.slot = String(i);
      cell.style.width = "64px";
      cell.style.height = "64px";
      pane.appendChild(cell);
    }

    document.body.appendChild(pane);
    return pane;
  }

  function dispatchPointerEvent(
    target: HTMLElement,
    type: "pointerdown" | "pointermove" | "pointerup",
    x: number,
    y: number,
    button = 0,
  ) {
    const evt = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button,
      pointerId: 1,
    });
    target.dispatchEvent(evt);
    // Also dispatch window-level event for pointermove/pointerup
    if (type === "pointermove" || type === "pointerup") {
      window.dispatchEvent(evt);
    }
  }

  describe("endDrag", () => {
    it("removes all ghost elements", () => {
      const ghost = document.createElement("div");
      ghost.className = "inv-drag-ghost";
      document.body.appendChild(ghost);
      endDrag();
      expect(document.querySelectorAll(".inv-drag-ghost").length).toBe(0);
    });

    it("clears .is-dragging classes", () => {
      const pane = createPaneWithCells(["a"]);
      pane.querySelector(".inv-grid-cell")!.classList.add("is-dragging");
      endDrag();
      expect(pane.querySelector(".is-dragging")).toBeNull();
    });

    it("clears .is-drag-over classes", () => {
      const pane = createPaneWithCells(["a"]);
      pane.querySelector(".inv-grid-cell")!.classList.add("is-drag-over");
      endDrag();
      expect(pane.querySelector(".is-drag-over")).toBeNull();
    });
  });

  describe("attachDragDropHandlers", () => {
    it("does not throw when attaching to an empty pane", () => {
      const pane = document.createElement("div");
      document.body.appendChild(pane);
      expect(() => attachDragDropHandlers(pane)).not.toThrow();
    });

    it("starts a drag on pointerdown over a draggable cell", () => {
      const pane = createPaneWithCells(["item-a"]);
      const cell = pane.querySelector(".inv-grid-cell") as HTMLElement;
      attachDragDropHandlers(pane);

      dispatchPointerEvent(cell, "pointerdown", 50, 50);

      expect(cell.classList.contains("is-dragging")).toBe(true);
      expect(document.querySelectorAll(".inv-drag-ghost").length).toBe(1);
    });

    it("ignores pointerdown on non-draggable elements", () => {
      const pane = createPaneWithCells(["item-a"]);
      const wrap = pane.querySelector(".inv-grid-wrap") as HTMLElement || pane;
      attachDragDropHandlers(pane);

      dispatchPointerEvent(wrap, "pointerdown", 50, 50);

      expect(document.querySelectorAll(".inv-drag-ghost").length).toBe(0);
    });

    it("ignores pointerdown with non-left button", () => {
      const pane = createPaneWithCells(["item-a"]);
      const cell = pane.querySelector(".inv-grid-cell") as HTMLElement;
      attachDragDropHandlers(pane);

      dispatchPointerEvent(cell, "pointerdown", 50, 50, 2);

      expect(document.querySelectorAll(".inv-drag-ghost").length).toBe(0);
    });

    it("emits inventory:grid-swap on drop over another item", () => {
      const pane = createPaneWithCells(["item-a", "item-b"]);
      const cellA = pane.querySelector('[data-item="item-a"]') as HTMLElement;
      const cellB = pane.querySelector('[data-item="item-b"]') as HTMLElement;
      attachDragDropHandlers(pane);

      const handler = vi.fn();
      const unsub = on("inventory:grid-swap", handler);

      dispatchPointerEvent(cellA, "pointerdown", 50, 50);
      dispatchPointerEvent(cellB, "pointerup", 150, 50);

      expect(handler).toHaveBeenCalledWith({
        containerId: "shipCargo",
        fromSlot: 0,
        toSlot: 1,
      });

      unsub();
    });

    it("does not emit inventory:grid-swap on drop to same slot", () => {
      const pane = createPaneWithCells(["item-a"]);
      const cell = pane.querySelector(".inv-grid-cell") as HTMLElement;
      attachDragDropHandlers(pane);

      const handler = vi.fn();
      const unsub = on("inventory:grid-swap", handler);

      dispatchPointerEvent(cell, "pointerdown", 50, 50);
      dispatchPointerEvent(cell, "pointerup", 50, 50);

      expect(handler).not.toHaveBeenCalled();

      unsub();
    });

    it("emits inventory:grid-insert on drop in a gap", () => {
      const pane = createPaneWithCells(["item-a"]);
      const cell = pane.querySelector(".inv-grid-cell") as HTMLElement;
      attachDragDropHandlers(pane);

      const handler = vi.fn();
      const unsub = on("inventory:grid-insert", handler);

      dispatchPointerEvent(cell, "pointerdown", 50, 50);
      // Drop well outside the cell (in the grid wrap background)
      window.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: 500,
        clientY: 500,
        button: 0,
        pointerId: 1,
      }));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        containerId: "shipCargo",
        fromSlot: 0,
      }));
      expect(handler.mock.calls[0][0].toVisualIndex).toBeGreaterThanOrEqual(0);

      unsub();
    });
  });
});
