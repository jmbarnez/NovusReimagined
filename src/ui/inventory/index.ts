import { sfxBlip } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { t } from "../../utils/i18n.js";
import {
  INV_STATE,
  persistInventoryViewMode,
  type InventoryViewMode,
  type InventoryItem,
  INVENTORY_PANE_IDS,
} from "./state.js";
import { normalizeItems } from "./tree.js";
import { renderInventoryHTML } from "./render.js";
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

export function splitStack(itemId: string, newQty: number) {
  const all = normalizeItems();
  const it = all.find((x) => x.id === itemId);
  if (!it || newQty <= 0 || newQty >= it.qty) return;
  showCargoToast(t("inventory.splitConfirmed", { name: it.name, newQty, remainder: it.qty - newQty }));
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

export function setFilter(text: string) {
  INV_STATE.filterText = text.trim().toLowerCase();
  rerenderInventory();
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
    onSplitStack: splitStack,
    onShowInfoPanel: showInfoPanel,
    onFitAction: queueFitAction,
    onRerender: rerenderInventory,
  };
}

function rerenderInventory() {
  hideInvHoverTip();
  const handlers = getEventHandlers();
  for (const pane of getInventoryPanes()) {
    pane.innerHTML = renderInventoryHTML();
    attachInventoryListenersToPane(pane, handlers);
  }
  updateInvOverlays(getOverlayHandlers());
}

export function mountInventoryInPane(paneId: string): void {
  const pane = document.getElementById(paneId);
  if (!pane) return;
  pane.innerHTML = renderInventoryHTML();
  attachInventoryListenersToPane(pane, getEventHandlers());
}

export function attachInventoryListeners() {
  attachPaneListeners(getEventHandlers());
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
