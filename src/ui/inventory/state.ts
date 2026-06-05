import type { ModuleDef } from "../../data/modules.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";

export const INVENTORY_PANE_IDS = ["bridge-pane-cargo", "hangar-pane-cargo"] as const;

export interface InventoryItem {
  id: string;
  name: string;
  group: string;
  qty: number;
  vol: number;
  type: "ore" | "mixedOre" | "material" | "ammo" | "loot" | "component" | "module" | "fitting";
  key: string;
  container: string;
  composition?: Record<string, number>;
  massKg?: number;
  meta?: ModuleDef;
  instance?: ModuleInstance;
  rarityColor?: string;
}

export interface TreeNode {
  id: string;
  label: string;
  icon: string;
  children?: TreeNode[];
}

export type InventoryViewMode = "grid" | "list";

export interface InventoryState {
  selectedTreeId: string;
  expanded: Set<string>;
  selectedItemId: string | null;
  filterText: string;
  sortKey: "name" | "group" | "qty" | "vol";
  sortDir: 1 | -1;
  viewMode: InventoryViewMode;
  contextMenu: { x: number; y: number; itemId: string } | null;
  infoPanelItemId: string | null;
  /** Screen position used to place the info panel (e.g. from context menu). */
  infoPanelAnchor: { x: number; y: number } | null;
}

const INV_VIEW_KEY = "novus-inv-view";

function loadInventoryViewMode(): InventoryViewMode {
  try {
    const raw = localStorage.getItem(INV_VIEW_KEY);
    if (raw === "list" || raw === "grid") return raw;
  } catch {
    /* ignore storage errors */
  }
  return "grid";
}

export const INV_STATE: InventoryState = {
  selectedTreeId: "shipCargo",
  expanded: new Set(["ship", "shipCargo"]),
  selectedItemId: null,
  filterText: "",
  sortKey: "name",
  sortDir: 1,
  viewMode: loadInventoryViewMode(),
  contextMenu: null,
  infoPanelItemId: null,
  infoPanelAnchor: null,
};

export function persistInventoryViewMode(mode: InventoryViewMode) {
  try {
    localStorage.setItem(INV_VIEW_KEY, mode);
  } catch {
    /* ignore storage errors */
  }
}
