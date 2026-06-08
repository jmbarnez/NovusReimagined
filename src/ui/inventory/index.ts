import "../styles/inventory.css";
import { sfxBlip } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { t } from "../../utils/i18n.js";
import { on } from "../../events.js";
import {
  INV_STATE,
  persistInventoryViewMode,
  type InventoryViewMode,
  type InventoryItem,
  INVENTORY_PANE_IDS,
} from "./state.js";
import { getItemsForContainer, normalizeItems } from "./tree.js";
import { renderInventoryHTML } from "./render.js";
import { getLayout } from "./grid-layout.js";
import {
  attachInventoryListeners as attachPaneListeners,
  attachInventoryListenersToPane,
  getInventoryPanes,
  type InventoryEventHandlers,
} from "./events.js";
import {
  hideInvHoverTip,
  showInvHoverTip,
  showCargoToast,
  updateInvOverlays,
  type InventoryOverlayHandlers,
  type ContextFitAction,
} from "./overlays.js";

export {
  INVENTORY_PANE_IDS,
  type InventoryItem,
  type TreeNode,
  type InventoryState,
  type InventoryViewMode,
} from "./state.js";
export { renderInventoryHTML } from "./render.js";

export function setInventoryViewMode(mode: InventoryViewMode) {
  if (INV_STATE.viewMode === mode) return;
  INV_STATE.viewMode = mode;
  hideInvHoverTip();
  persistInventoryViewMode(mode);
  sfxBlip(660, 0.04);
  rerenderInventory();
}

export function jettisonItem(itemId: string, qty: number | null = null) {
  const all = normalizeItems();
  const it = all.find((x) => x.id === itemId);
  if (!it) return;
  const drop = qty == null ? it.qty : Math.min(qty, it.qty);
  if (drop <= 0) return;

  queueFrameAction({ type: "jettisonItem", payload: { itemId: it.id, qty: drop } });
  INV_STATE.selectedItemId = INV_STATE.selectedItemId === itemId ? null : INV_STATE.selectedItemId;
  rerenderInventory();
}

export function splitStack(_itemId: string, _newQty: number) {
  // Split-stack is not supported by the current quantity-map inventory model.
  // Use jettison-partial instead.
}

export function selectTreeNode(nodeId: string) {
  INV_STATE.selectedTreeId = nodeId;
  INV_STATE.selectedItemId = null;
  INV_STATE.contextMenu = null;
  INV_STATE.infoPanelItemId = null;
  INV_STATE.infoPanelAnchor = null;
  rerenderInventory();
}

export function toggleTreeNode(nodeId: string) {
  if (INV_STATE.expanded.has(nodeId)) INV_STATE.expanded.delete(nodeId);
  else INV_STATE.expanded.add(nodeId);
  rerenderInventory();
}

export function selectItem(itemId: string | null) {
  INV_STATE.selectedItemId = itemId === INV_STATE.selectedItemId ? null : itemId;
  INV_STATE.contextMenu = null;
  const sel = INV_STATE.selectedItemId;
  if (!sel || sel !== INV_STATE.infoPanelItemId) {
    INV_STATE.infoPanelItemId = null;
    INV_STATE.infoPanelAnchor = null;
  }
  rerenderInventory();
}

let _filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function setFilter(text: string) {
  INV_STATE.filterText = text.trim().toLowerCase();
  if (_filterDebounceTimer) clearTimeout(_filterDebounceTimer);
  _filterDebounceTimer = setTimeout(() => {
    rerenderInventory();
  }, 80);
}

export function showItemContextMenu(itemId: string, x: number, y: number) {
  INV_STATE.selectedItemId = itemId;
  INV_STATE.contextMenu = { x, y, itemId };
  rerenderInventory();
}

export function closeContextMenu() {
  if (!INV_STATE.contextMenu) return;
  INV_STATE.contextMenu = null;
  updateInvOverlays(getOverlayHandlers());
}

export function closeInfoPanel() {
  INV_STATE.infoPanelItemId = null;
  INV_STATE.infoPanelAnchor = null;
  updateInvOverlays(getOverlayHandlers());
}

export function showInfoPanel(itemId: string, anchorX?: number, anchorY?: number) {
  INV_STATE.infoPanelItemId = itemId;
  if (anchorX != null && anchorY != null) {
    INV_STATE.infoPanelAnchor = { x: anchorX, y: anchorY };
  } else {
    INV_STATE.infoPanelAnchor = null;
  }
  rerenderInventory();
}

function moveHoverTip(clientX: number, clientY: number) {
  const tip = document.getElementById("inv-hover-tip");
  if (tip && tip.style.display !== "none") {
    tip.style.left = `${clientX + 12}px`;
    tip.style.top = `${clientY + 12}px`;
  }
}

function getEventHandlers(): InventoryEventHandlers {
  return {
    toggleTreeNode,
    selectTreeNode,
    selectItem,
    showItemContextMenu,
    setInventoryViewMode,
    setFilter,
    rerenderInventory,
    closeContextMenu,
    showHoverTip: (itemId: string, clientX: number, clientY: number) => {
      const it = normalizeItems().find((x) => x.id === itemId);
      if (it) showInvHoverTip(it, clientX, clientY);
    },
    moveHoverTip,
    hideHoverTip: hideInvHoverTip,
  };
}

function queueFitAction(action: ContextFitAction) {
  if (action.kind === "fit") {
    queueFrameAction({ type: "fitModule", payload: { rack: action.rack, slotIdx: action.slotIdx, instanceId: action.uid } });
  } else if (action.kind === "unfit") {
    queueFrameAction({ type: "unfitModule", payload: { rack: action.rack, slotIdx: action.slotIdx } });
  } else {
    queueFrameAction({ type: "swapModule", payload: { rack: action.rack, slotIdx: action.slotIdx, instanceId: action.uid } });
  }
}

function getOverlayHandlers(): InventoryOverlayHandlers {
  return {
    onCloseContextMenu: closeContextMenu,
    onJettisonItem: jettisonItem,
    onShowInfoPanel: showInfoPanel,
    onFitAction: queueFitAction,
    onRerender: rerenderInventory,
  };
}

// ─── Smart re-render: avoid innerHTML rebuild when only selection changes ───

let _lastContentHash = "";
let _lastSelectedId: string | null = null;

function computeContentHash(): string {
  const items = getItemsForContainer(INV_STATE.selectedTreeId);
  const filtered = INV_STATE.filterText
    ? items.filter((it: InventoryItem) => it.name.toLowerCase().includes(INV_STATE.filterText) || it.group.toLowerCase().includes(INV_STATE.filterText))
    : items;
  const sorted = [...filtered].sort((a, b) => {
    const d = INV_STATE.sortDir;
    switch (INV_STATE.sortKey) {
      case "group": return d * a.group.localeCompare(b.group);
      case "qty": return d * (a.qty - b.qty);
      case "vol": return d * ((a.vol || 0) * a.qty - (b.vol || 0) * b.qty);
      default: return d * a.name.localeCompare(b.name);
    }
  });
  const layout = INV_STATE.viewMode === "grid" ? getLayout(INV_STATE.selectedTreeId) : null;
  const layoutHash = layout ? layout.positions.map(p => `${p.itemId}@${p.slotIndex}`).join(",") : "";
  return `${INV_STATE.selectedTreeId}|${INV_STATE.viewMode}|${INV_STATE.sortKey}|${INV_STATE.sortDir}|${INV_STATE.filterText}|${sorted.map((i) => `${i.id}:${i.qty}`).join(",")}|${Array.from(INV_STATE.expanded).join(",")}|${layoutHash}`;
}

function updateSelectionOnly(pane: HTMLElement) {
  for (const el of pane.querySelectorAll(".inv-item")) {
    const itemId = (el as HTMLElement).dataset.item;
    el.classList.toggle("is-selected", itemId === INV_STATE.selectedItemId);
  }
}

function rerenderInventory() {
  const hash = computeContentHash();
  const contentChanged = hash !== _lastContentHash;
  const selectionChanged = INV_STATE.selectedItemId !== _lastSelectedId;
  const handlers = getEventHandlers();

  for (const pane of getInventoryPanes()) {
    if (contentChanged) {
      hideInvHoverTip();
      pane.innerHTML = renderInventoryHTML();
      attachInventoryListenersToPane(pane, handlers);
    } else if (selectionChanged && pane.querySelector(".inv-item")) {
      updateSelectionOnly(pane);
    }
  }

  _lastContentHash = hash;
  _lastSelectedId = INV_STATE.selectedItemId;
  updateInvOverlays(getOverlayHandlers());
}

// Re-render inventory when server snapshot updates cargo / fitting state.
on("inventory:changed", () => {
  rerenderInventory();
});

function syncContentHashAfterMount() {
  _lastContentHash = computeContentHash();
  _lastSelectedId = INV_STATE.selectedItemId;
}

export function mountInventoryInPane(paneId: string): void {
  const pane = document.getElementById(paneId);
  if (!pane) return;
  pane.innerHTML = renderInventoryHTML();
  attachInventoryListenersToPane(pane, getEventHandlers());
  syncContentHashAfterMount();
}

export function attachInventoryListeners() {
  attachPaneListeners(getEventHandlers());
  syncContentHashAfterMount();
}

export function resetInventoryUI() {
  INV_STATE.selectedTreeId = "shipCargo";
  INV_STATE.expanded = new Set(["ship", "shipCargo"]);
  INV_STATE.selectedItemId = null;
  INV_STATE.filterText = "";
  INV_STATE.contextMenu = null;
  INV_STATE.infoPanelItemId = null;
  INV_STATE.infoPanelAnchor = null;
  updateInvOverlays(getOverlayHandlers());
}

// Keep explicit export so external callers can reference pane IDs from this entrypoint.
void INVENTORY_PANE_IDS;
