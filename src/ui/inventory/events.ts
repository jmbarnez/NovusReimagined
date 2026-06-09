import { sfxBlip } from "../../audio/procedural.js";
import { INVENTORY_PANE_IDS, INV_STATE, type InventoryViewMode } from "./state.js";
import { findNode, getTreeNodes, normalizeItems } from "./tree.js";
import { attachDragDropHandlers } from "./drag-drop.js";
import { getElement, query, onClick, onMouseEnter, onMouseLeave, onMouseMove, onContextMenu, onInput, onKeydown } from "../dom-helpers.js";

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
    .map((id) => getElement(id))
    .filter((el): el is HTMLElement => el !== null);

  // Also check for inventory panes inside HUD windows (e.g., floating cargo window)
  const hudCargoPane = query("#hud-win-cargo .br-pane");
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
    onClick(nodeEl, (e) => {
      (e as MouseEvent).stopPropagation();
      sfxBlip(660, 0.04);
      const id = (nodeEl as HTMLElement).dataset.node;
      const nodes = getTreeNodes();
      const hasChildren = (id ? findNode(nodes, id)?.children?.length ?? 0 : 0) > 0;
      if (hasChildren && id) handlers.toggleTreeNode(id);
      if (id) handlers.selectTreeNode(id);
    });
  }

  for (const row of pane.querySelectorAll("[data-item]")) {
    onClick(row, (e) => {
      // Skip click for draggable grid cells to allow drag-drop
      if (INV_STATE.viewMode === "grid" && (row as HTMLElement).draggable) return;

      (e as MouseEvent).stopPropagation();
      sfxBlip(720, 0.04);
      handlers.selectItem((row as HTMLElement).dataset.item || null);
    });
    onContextMenu(row, (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.hideHoverTip();
      handlers.showItemContextMenu((row as HTMLElement).dataset.item!, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
    });

    if (INV_STATE.viewMode === "grid") {
      const itemId = (row as HTMLElement).dataset.item;
      const it = itemId ? normalizeItems().find((x) => x.id === itemId) : undefined;
      if (it) {
        onMouseEnter(row, (e) => {
          handlers.showHoverTip(it.id, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
        });
        onMouseMove(row, (e) => {
          handlers.moveHoverTip((e as MouseEvent).clientX, (e as MouseEvent).clientY);
        });
        onMouseLeave(row, () => handlers.hideHoverTip());
      }
    }
  }

  for (const viewBtn of pane.querySelectorAll(".inv-view-btn")) {
    onClick(viewBtn, (e) => {
      (e as MouseEvent).stopPropagation();
      const mode = (viewBtn as HTMLElement).dataset.view as InventoryViewMode | undefined;
      if (mode === "grid" || mode === "list") handlers.setInventoryViewMode(mode);
    });
  }

  const SORT_CYCLE: ("name" | "group" | "qty" | "vol")[] = ["name", "group", "qty", "vol"];
  const sortBtn = pane.querySelector(".inv-sort-btn");
  if (sortBtn) {
    onClick(sortBtn, (e) => {
      (e as MouseEvent).stopPropagation();
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
    onContextMenu(sortBtn, (e) => {
      e.preventDefault();
      e.stopPropagation();
      INV_STATE.sortDir = (INV_STATE.sortDir * -1) as 1 | -1;
      sfxBlip(640, 0.04);
      handlers.rerenderInventory();
    });
  }

  const filterInput = pane.querySelector(".inv-filter-input");
  if (filterInput) {
    onInput(filterInput, (e) => {
      handlers.setFilter((e.target as HTMLInputElement).value);
    });
    onKeydown(filterInput, (e) => (e as KeyboardEvent).stopPropagation());
  }

  if (!paneClickAttached.has(pane.id)) {
    paneClickAttached.add(pane.id);
    onClick(pane, () => {
      handlers.closeContextMenu();
    });
  }

  if (INV_STATE.viewMode === "grid") {
    attachDragDropHandlers(pane);
  }
}

export function getInventoryPaneById(paneId: string): HTMLElement | null {
  return getElement(paneId);
}
