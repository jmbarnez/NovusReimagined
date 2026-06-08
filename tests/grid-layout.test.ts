import { describe, it, expect, beforeEach } from "vitest";
import {
  getLayout,
  setLayout,
  getPosition,
  removePosition,
  mergeLayoutWithItems,
  moveItemInGrid,
  swapItems,
  insertItem,
  clearLayout,
} from "../src/ui/inventory/grid-layout.js";

const CONTAINER = "test-container";

describe("grid-layout", () => {
  beforeEach(() => {
    clearLayout(CONTAINER);
    localStorage.clear();
  });

  describe("getLayout", () => {
    it("returns an empty layout for a new container", () => {
      const layout = getLayout(CONTAINER);
      expect(layout.positions).toEqual([]);
      expect(layout.nextSlot).toBe(0);
    });

    it("returns the same cached layout on repeated calls", () => {
      const first = getLayout(CONTAINER);
      const second = getLayout(CONTAINER);
      expect(second).toBe(first);
    });

    it("loads persisted layout from localStorage", () => {
      const persisted = { positions: [{ itemId: "a", slotIndex: 2 }], nextSlot: 3 };
      localStorage.setItem("novus-inv-grid-test-container", JSON.stringify(persisted));
      const layout = getLayout(CONTAINER);
      expect(layout.positions).toEqual([{ itemId: "a", slotIndex: 2 }]);
      expect(layout.nextSlot).toBe(3);
    });
  });

  describe("setLayout", () => {
    it("persists layout to localStorage", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "x", slotIndex: 5 }], nextSlot: 6 });
      const raw = localStorage.getItem("novus-inv-grid-test-container");
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual({ positions: [{ itemId: "x", slotIndex: 5 }], nextSlot: 6 });
    });
  });

  describe("getPosition", () => {
    it("returns the slot index for an existing item", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 3 }], nextSlot: 4 });
      expect(getPosition(CONTAINER, "a")).toBe(3);
    });

    it("returns null for a missing item", () => {
      expect(getPosition(CONTAINER, "missing")).toBeNull();
    });
  });

  describe("removePosition", () => {
    it("removes an item from the layout", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      removePosition(CONTAINER, "a");
      expect(getPosition(CONTAINER, "a")).toBeNull();
      expect(getPosition(CONTAINER, "b")).toBe(1);
    });

    it("is a no-op for a missing item", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      removePosition(CONTAINER, "missing");
      expect(getPosition(CONTAINER, "a")).toBe(0);
    });
  });

  describe("mergeLayoutWithItems", () => {
    it("preserves relative order for existing items", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 2 },
          { itemId: "b", slotIndex: 5 },
        ],
        nextSlot: 6,
      });
      mergeLayoutWithItems(CONTAINER, ["a", "b"]);
      expect(getPosition(CONTAINER, "a")).toBe(0);
      expect(getPosition(CONTAINER, "b")).toBe(1);
    });

    it("appends new items and renumbers to dense", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 2 },
        ],
        nextSlot: 3,
      });
      mergeLayoutWithItems(CONTAINER, ["a", "b", "c"]);
      expect(getPosition(CONTAINER, "a")).toBe(0);
      expect(getPosition(CONTAINER, "b")).toBe(1);
      expect(getPosition(CONTAINER, "c")).toBe(2);
    });

    it("removes deleted items and renumbers remaining to dense", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      mergeLayoutWithItems(CONTAINER, ["a"]);
      expect(getPosition(CONTAINER, "b")).toBeNull();
      expect(getPosition(CONTAINER, "a")).toBe(0);
    });

    it("is a no-op when nothing changed", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      mergeLayoutWithItems(CONTAINER, ["a"]);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });
  });

  describe("swapItems", () => {
    it("swaps two items by slotIndex", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      swapItems(CONTAINER, 0, 1);
      expect(getPosition(CONTAINER, "a")).toBe(1);
      expect(getPosition(CONTAINER, "b")).toBe(0);
    });

    it("is a no-op when slots are the same", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      swapItems(CONTAINER, 0, 0);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });

    it("is a no-op when one slot is missing", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      swapItems(CONTAINER, 0, 99);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });
  });

  describe("insertItem", () => {
    it("inserts an item at the beginning", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      insertItem(CONTAINER, 1, 0);
      expect(getPosition(CONTAINER, "b")).toBe(0);
      expect(getPosition(CONTAINER, "a")).toBe(1);
    });

    it("inserts an item at the end", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      insertItem(CONTAINER, 0, 2);
      expect(getPosition(CONTAINER, "a")).toBe(1);
      expect(getPosition(CONTAINER, "b")).toBe(0);
    });

    it("inserts an item in the middle", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
          { itemId: "c", slotIndex: 2 },
        ],
        nextSlot: 3,
      });
      insertItem(CONTAINER, 2, 1);
      expect(getPosition(CONTAINER, "a")).toBe(0);
      expect(getPosition(CONTAINER, "c")).toBe(1);
      expect(getPosition(CONTAINER, "b")).toBe(2);
    });

    it("is a no-op when the source slot is missing", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      insertItem(CONTAINER, 99, 0);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });

    it("renumbers all positions to dense 0..n-1", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 5 },
        ],
        nextSlot: 6,
      });
      insertItem(CONTAINER, 5, 0);
      const layout = getLayout(CONTAINER);
      const slots = layout.positions.map(p => p.slotIndex).sort((a, b) => a - b);
      expect(slots).toEqual([0, 1]);
    });
  });

  describe("moveItemInGrid", () => {
    it("swaps two occupied slots", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      moveItemInGrid(CONTAINER, 0, 1);
      expect(getPosition(CONTAINER, "a")).toBe(1);
      expect(getPosition(CONTAINER, "b")).toBe(0);
    });

    it("moves an item to an empty slot", () => {
      setLayout(CONTAINER, {
        positions: [{ itemId: "a", slotIndex: 0 }],
        nextSlot: 1,
      });
      moveItemInGrid(CONTAINER, 0, 5);
      expect(getPosition(CONTAINER, "a")).toBe(5);
    });

    it("is a no-op when from and to are the same slot", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      moveItemInGrid(CONTAINER, 0, 0);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });

    it("is a no-op when the source slot is empty", () => {
      setLayout(CONTAINER, { positions: [{ itemId: "a", slotIndex: 0 }], nextSlot: 1 });
      const before = getLayout(CONTAINER);
      moveItemInGrid(CONTAINER, 99, 1);
      const after = getLayout(CONTAINER);
      expect(after).toBe(before);
    });

    it("updates nextSlot to max slot + 1", () => {
      setLayout(CONTAINER, {
        positions: [
          { itemId: "a", slotIndex: 0 },
          { itemId: "b", slotIndex: 1 },
        ],
        nextSlot: 2,
      });
      moveItemInGrid(CONTAINER, 0, 10);
      expect(getLayout(CONTAINER).nextSlot).toBe(11);
    });
  });
});
