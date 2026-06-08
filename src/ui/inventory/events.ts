import { sfxBlip } from "../../audio/procedural.js";
import { INVENTORY_PANE_IDS, INV_STATE, type InventoryViewMode } from "./state.js";
import { findNode, getTreeNodes, normalizeItems } from "./tree.js";
import { attachDragDropHandlers } from "./drag-drop.js";

export interface InventoryEventHandlers {
  toggleTreeNode: (nodeId: string) => void;
  selectTreeNode: (nodeId: string) => void;
  selectItem: (itemId: string | null) => void;
  showItemContextMenu: (itemId: string, x: number, y: number) => void;
  setInventoryViewMode: (mode: InventoryViewMode) => void;
  setFilter: (text: string) => void;
  rerenderInventory: () => void;
  closeContextMenu: () => void;
  showHoverTip: (itemId: string, clientX: number, clientY: number) => void;
  moveHoverTip: (clientX: number, clientY: number) => void;
  hideHoverTip: () => void;
}

export function getInventoryPanes(): HTMLElement[] {
  // First check for known pane IDs
  const panes = INVENTORY_PANE_IDS
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);

  // Also check for inventory panes inside HUD windows (e.g., floating cargo window)
  const hudCargoPane = document.querySelector("#hud-win-cargo .br-pane");
  if (hudCargoPane && hudCargoPane instanceof HTMLElement) {
    panes.push(hudCargoPane);
  }

  return panes;
}

const paneClickAttached = new Set<string>();

export function attachInventoryListeners(handlers: InventoryEventHandlers) {
  for (const pane of getInventoryPanes()) {
    attachInventoryListenersToPane(pane, handlers);
  }
}

export function attachInventoryListenersToPane(pane: HTMLElement, handlers: InventoryEventHandlers) {
  for (const nodeEl of pane.querySelectorAll(".inv-tree-node")) {
    nodeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      sfxBlip(660, 0.04);
      const id = (nodeEl as HTMLElement).dataset.node;
      const nodes = getTreeNodes();
      const hasChildren = (id ? findNode(nodes, id)?.children?.length ?? 0 : 0) > 0;
      if (hasChildren && id) handlers.toggleTreeNode(id);
      if (id) handlers.selectTreeNode(id);
    });
  }

  for (const row of pane.querySelectorAll("[data-item]")) {
    row.addEventListener("click", (e) => {
      // Skip click for draggable grid cells to allow drag-drop
      if (INV_STATE.viewMode === "grid" && (row as HTMLElement).draggable) return;

      e.stopPropagation();
      sfxBlip(720, 0.04);
      handlers.selectItem((row as HTMLElement).dataset.item || null);
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.hideHoverTip();
      handlers.showItemContextMenu((row as HTMLElement).dataset.item!, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
    });

    if (INV_STATE.viewMode === "grid") {
      const itemId = (row as HTMLElement).dataset.item;
      const it = itemId ? normalizeItems().find((x) => x.id === itemId) : undefined;
      if (it) {
        row.addEventListener("mouseenter", (e) => {
          handlers.showHoverTip(it.id, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
        });
        row.addEventListener("mousemove", (e) => {
          handlers.moveHoverTip((e as MouseEvent).clientX, (e as MouseEvent).clientY);
        });
        row.addEventListener("mouseleave", () => handlers.hideHoverTip());
      }
    }
  }

  for (const viewBtn of pane.querySelectorAll(".inv-view-btn")) {
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = (viewBtn as HTMLElement).dataset.view as InventoryViewMode | undefined;
      if (mode === "grid" || mode === "list") handlers.setInventoryViewMode(mode);
    });
  }

  const SORT_CYCLE: ("name" | "group" | "qty" | "vol")[] = ["name", "group", "qty", "vol"];
  const sortBtn = pane.querySelector(".inv-sort-btn");
  if (sortBtn) {
    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const curIdx = SORT_CYCLE.indexOf(INV_STATE.sortKey);
      const nextIdx = (curIdx + 1) % SORT_CYCLE.length;
      if (SORT_CYCLE[nextIdx] === INV_STATE.sortKey) {
        INV_STATE.sortDir = (INV_STATE.sortDir * -1) as 1 | -1;
      } else {
        INV_STATE.sortKey = SORT_CYCLE[nextIdx]!;
        INV_STATE.sortDir = 1;
      }
      sfxBlip(640, 0.04);
      handlers.rerenderInventory();
    });
    sortBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      INV_STATE.sortDir = (INV_STATE.sortDir * -1) as 1 | -1;
      sfxBlip(640, 0.04);
      handlers.rerenderInventory();
    });
  }

  const filterInput = pane.querySelector(".inv-filter-input");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      handlers.setFilter((e.target as HTMLInputElement).value);
    });
    filterInput.addEventListener("keydown", (e) => e.stopPropagation());
  }

  if (!paneClickAttached.has(pane.id)) {
    paneClickAttached.add(pane.id);
    pane.addEventListener("click", () => {
      handlers.closeContextMenu();
    });
  }

  if (INV_STATE.viewMode === "grid") {
    attachDragDropHandlers(pane, { onRerender: handlers.rerenderInventory });
  }
}

export function getInventoryPaneById(paneId: string): HTMLElement | null {
  return document.getElementById(paneId);
}
