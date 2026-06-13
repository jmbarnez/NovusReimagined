import { sfxBlip, sfxConfirm, sfxError } from "../../../audio/procedural.js";
import { canModifyFitting } from "../../../utils/fitting-gate.js";
import { t } from "../../../utils/i18n.js";
import { Client } from "../../../state.js";
import { getElement, setHtml, setStyle } from "../../dom-helpers.js";
import { openHudWindow, closeHudWindow, isOpen as isHudWindowOpen } from "../../hud/windows.js";
import { INV_STATE } from "../state.js";
import { normalizeItems } from "../tree.js";
import { ensureInvCtxRoot, ensureCargoToast, INFO_WINDOW_ID } from "./elements.js";
import { showCargoToast } from "./toast.js";
import { clampCtxPosition, ensureOutsideDismissHandlers } from "./position.js";
import { buildContextMenuHTML } from "./ctx-html.js";
import { buildInfoPanelInnerHTML } from "./info-html.js";
import type { ContextFitAction, InventoryOverlayHandlers } from "./types.js";

/** Stacks at or above this total qty require confirmation before jettison-all. */
const JETTISON_CONFIRM_THRESHOLD = 50;

export function updateInvContextOverlay(handlers: InventoryOverlayHandlers) {
  ensureOutsideDismissHandlers(handlers.onCloseContextMenu);
  ensureCargoToast();
  const root = ensureInvCtxRoot();
  const cm = INV_STATE.contextMenu;
  if (!cm) {
    setStyle(root, { display: "none", pointerEvents: "none" });
    setHtml(root, "");
    return;
  }

  const html = buildContextMenuHTML(cm.itemId);
  if (!html) {
    INV_STATE.contextMenu = null;
    setStyle(root, { display: "none", pointerEvents: "none" });
    setHtml(root, "");
    return;
  }

  setHtml(root, html);
  setStyle(root, { display: "block", pointerEvents: "auto" });

  const menuEl = root.querySelector(".inv-ctx") as HTMLElement | null;
  if (menuEl) {
    const scale = Client.settings?.uiScale ?? 1.0;
    setStyle(menuEl, { left: `${cm.x / scale}px`, top: `${cm.y / scale}px` });
    clampCtxPosition(menuEl, cm.x, cm.y);
  }

  root.onclick = (ev) => {
    ev.stopPropagation();
    const target = ev.target as HTMLElement | null;
    const item = target?.closest?.(".inv-ctx-item") as HTMLElement | null;
    if (!item || item.classList.contains("is-disabled")) return;
    const action = item.dataset.action;
    const itemId = item.dataset.item;
    if (!action || !itemId) return;

    if (action === "jettison-all") {
      const all = normalizeItems();
      const it = all.find((i) => i.id === itemId);
      if (!it) return;
      if (it.qty >= JETTISON_CONFIRM_THRESHOLD) {
        if (!window.confirm(t("inventory.confirmJettisonAll", { qty: it.qty.toLocaleString(), name: it.name }))) {
          handlers.onCloseContextMenu();
          return;
        }
      }
      sfxConfirm();
      handlers.onJettisonItem(itemId, null);
    } else if (action === "jettison-partial") {
      const all = normalizeItems();
      const it = all.find((i) => i.id === itemId);
      if (!it || it.qty <= 1) return;
      const raw = window.prompt(t("inventory.promptJettisonQty", { qty: it.qty }), "1");
      if (raw == null) {
        handlers.onCloseContextMenu();
        return;
      }
      const n = parseInt(raw.replace(/,/g, ""), 10);
      if (!Number.isFinite(n) || n < 1 || n > it.qty) {
        sfxError();
        showCargoToast(t("inventory.invalidQty"));
        handlers.onCloseContextMenu();
        return;
      }
      if (n >= JETTISON_CONFIRM_THRESHOLD) {
        if (!window.confirm(t("inventory.confirmJettison", { n: n.toLocaleString(), name: it.name }))) {
          handlers.onCloseContextMenu();
          return;
        }
      }
      sfxConfirm();
      handlers.onJettisonItem(itemId, n);
    } else if (action === "info") {
      sfxBlip();
      const { x: ax, y: ay } = cm;
      handlers.onCloseContextMenu();
      handlers.onShowInfoPanel(itemId, ax, ay);
      return;
    } else if (action.startsWith("fit:") || action.startsWith("swap:") || action.startsWith("unfit:")) {
      const parts = action.split(":");
      const kind = parts[0] as "fit" | "swap" | "unfit";
      const rack = parts[1] as "turret" | "high" | "med" | "low";
      const slotIdx = parseInt(parts[2] ?? "", 10);
      const allItems = normalizeItems();
      const mod = allItems.find((i) => i.id === itemId);
      if (!mod || !Number.isFinite(slotIdx)) return;
      const uid = mod.instance?.uid ?? mod.key;
      if (!canModifyFitting().ok) {
        sfxError();
        showCargoToast(t("inventory.cannotModify"));
        handlers.onCloseContextMenu();
        return;
      }
      handlers.onFitAction({ kind, rack, slotIdx, uid });
      sfxConfirm();
      handlers.onRerender();
    }
    handlers.onCloseContextMenu();
  };
}

export function updateInvInfoOverlay() {
  const id = INV_STATE.infoPanelItemId;
  if (!id) {
    if (isHudWindowOpen(INFO_WINDOW_ID)) closeHudWindow(INFO_WINDOW_ID);
    return;
  }
  const all = normalizeItems();
  const it = all.find((i) => i.id === id);
  if (!it) {
    INV_STATE.infoPanelItemId = null;
    INV_STATE.infoPanelAnchor = null;
    if (isHudWindowOpen(INFO_WINDOW_ID)) closeHudWindow(INFO_WINDOW_ID);
    return;
  }
  openHudWindow(INFO_WINDOW_ID, it.name, buildInfoPanelInnerHTML(it), () => {
    INV_STATE.infoPanelItemId = null;
    INV_STATE.infoPanelAnchor = null;
  });
}

export function updateInvOverlays(handlers: InventoryOverlayHandlers) {
  updateInvContextOverlay(handlers);
  updateInvInfoOverlay();
}
