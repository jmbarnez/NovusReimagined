import { describe, it, expect, beforeEach } from "vitest";
import { _G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { mountInventoryInPane, resetInventoryUI } from "../src/ui/inventory/index.js";
import { emit } from "../src/events.js";

describe("hangar cargo panel toolbar", () => {
  beforeEach(() => {
    _G.P = makePlayer() as any;
    resetInventoryUI();
    // Clean up any previously created panes
    document.body.innerHTML = "";
  });

  it("does not thrash DOM when inventory:changed fires with no state change", () => {
    const pane = document.createElement("div");
    pane.id = "hangar-pane-cargo";
    document.body.appendChild(pane);

    mountInventoryInPane("hangar-pane-cargo");

    const toolbar = pane.querySelector(".inv-toolbar");
    expect(toolbar).not.toBeNull();

    // Emit inventory:changed without changing any state
    emit("inventory:changed");

    // The toolbar element should still be the exact same DOM node
    expect(pane.querySelector(".inv-toolbar")).toBe(toolbar);
  });

  it("does not thrash DOM when inventory:changed fires repeatedly", () => {
    const pane = document.createElement("div");
    pane.id = "hangar-pane-cargo";
    document.body.appendChild(pane);

    mountInventoryInPane("hangar-pane-cargo");

    const viewBtn = pane.querySelector('.inv-view-btn[data-view="list"]') as HTMLButtonElement;
    expect(viewBtn).not.toBeNull();

    // Fire the event multiple times
    emit("inventory:changed");
    emit("inventory:changed");
    emit("inventory:changed");

    // The view button should still be the exact same DOM node
    expect(pane.querySelector('.inv-view-btn[data-view="list"]')).toBe(viewBtn);
  });

  it("re-renders when a view button is clicked", () => {
    const pane = document.createElement("div");
    pane.id = "hangar-pane-cargo";
    document.body.appendChild(pane);

    mountInventoryInPane("hangar-pane-cargo");

    const gridBtn = pane.querySelector('.inv-view-btn[data-view="grid"]') as HTMLButtonElement;
    expect(gridBtn).not.toBeNull();
    expect(gridBtn.classList.contains("is-active")).toBe(true);

    // Click the list view button
    const listBtn = pane.querySelector('.inv-view-btn[data-view="list"]') as HTMLButtonElement;
    expect(listBtn).not.toBeNull();
    listBtn.click();

    // After clicking list, the list button should be active and grid inactive
    const newGridBtn = pane.querySelector('.inv-view-btn[data-view="grid"]') as HTMLButtonElement;
    const newListBtn = pane.querySelector('.inv-view-btn[data-view="list"]') as HTMLButtonElement;
    expect(newListBtn.classList.contains("is-active")).toBe(true);
    expect(newGridBtn.classList.contains("is-active")).toBe(false);
  });

  it("re-renders when sort button is clicked", () => {
    const pane = document.createElement("div");
    pane.id = "hangar-pane-cargo";
    document.body.appendChild(pane);

    mountInventoryInPane("hangar-pane-cargo");

    const sortBtn = pane.querySelector(".inv-sort-btn") as HTMLButtonElement;
    expect(sortBtn).not.toBeNull();
    const initialLabel = sortBtn.textContent;

    sortBtn.click();

    // Sort label should have changed
    const newSortBtn = pane.querySelector(".inv-sort-btn") as HTMLButtonElement;
    expect(newSortBtn.textContent).not.toBe(initialLabel);
  });
});
