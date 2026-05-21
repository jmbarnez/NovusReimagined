import { G, Client } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { MODULES, MODULE_HOLD_VOLUME_M3, type ModuleDef } from "../data/modules.js";
import { escHtml } from "../utils/format.js";
import { sfxBlip, sfxConfirm } from "../audio/procedural.js";
import { RARITY_CONFIG } from "../data/moduleRarity.js";
import { getInstance } from "../utils/items.js";
import { jettisonItemAction } from "../state/actions.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

// ─── Interfaces ───
export interface InventoryItem {
  id: string;
  name: string;
  group: string;
  qty: number;
  vol: number;
  type: "ore" | "ammo" | "refined" | "loot" | "component" | "module" | "fitting";
  key: string;
  container: string;
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

export interface InventoryState {
  selectedTreeId: string;
  expanded: Set<string>;
  selectedItemId: string | null;
  filterText: string;
  sortKey: "name" | "group" | "qty" | "vol";
  sortDir: 1 | -1;
  contextMenu: { x: number; y: number; itemId: string } | null;
  colWidths: Record<"name" | "group" | "qty" | "vol", number>;
}

// ─── Inline SVG Icons ───
const ICON_SVG = (paths: string, vb: string = "0 0 16 16") => `<svg class="inv-svg-icon" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONS: Record<string, string> = {
  ship:       ICON_SVG('<path d="M2 12l4-8 4 8M4 10h4"/>'),
  cargo:      ICON_SVG('<rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 7h12"/>'),
  fitting:    ICON_SVG('<path d="M4 4l8 8M12 4l-8 8"/><circle cx="8" cy="8" r="2"/>'),
  station:    ICON_SVG('<path d="M4 13V7l4-3 4 3v6"/><path d="M2 13h12"/>'),
  hangar:     ICON_SVG('<rect x="2" y="9" width="12" height="5" rx="1"/><rect x="4" y="4" width="8" height="5" rx="1"/>'),
  ore:        ICON_SVG('<path d="M5 13L3 8l4-5 4 5-2 5z"/><path d="M5 8h6"/>'),
  ammo:       ICON_SVG('<rect x="6" y="2" width="4" height="10" rx="2"/><path d="M7 12v2"/>'),
  refined:    ICON_SVG('<rect x="3" y="6" width="10" height="7" rx="1"/><path d="M5 6V4h6v2"/>'),
  loot:       ICON_SVG('<path d="M4 13l2-9 4 0 2 9z"/><path d="M6 7h4"/>'),
  component:  ICON_SVG('<rect x="3" y="5" width="10" height="8" rx="1"/><path d="M6 5V3h4v2"/><path d="M5 9h6"/><path d="M5 11h4"/>'),
  module:     ICON_SVG('<rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="8" cy="8" r="2"/>'),
  turret:     ICON_SVG('<circle cx="8" cy="8" r="5"/><path d="M8 3v3M8 10v3M3 8h3M10 8h3"/>'),
  high:       ICON_SVG('<path d="M8 2v6l4 2"/><circle cx="8" cy="8" r="5"/>'),
  med:        ICON_SVG('<path d="M8 2v4"/><path d="M3 13c0-3 2.2-5 5-5s5 2 5 5z"/>'),
  low:        ICON_SVG('<rect x="3" y="6" width="10" height="7" rx="1"/><path d="M5 6V4h6v2"/><path d="M3 10h10"/>'),
};

function iconForItem(it: InventoryItem): string {
  if (it.type === "ore")       return ICONS.ore;
  if (it.type === "ammo")      return ICONS.ammo;
  if (it.type === "refined")   return ICONS.refined;
  if (it.type === "loot")      return ICONS.loot;
  if (it.type === "component") return ICONS.component;
  if (it.type === "module" || it.type === "fitting") {
    const rack = it.meta?.rack;
    if (rack === "turret") return ICONS.turret;
    if (rack === "high")   return ICONS.high;
    if (rack === "med")    return ICONS.med;
    if (rack === "low")    return ICONS.low;
    return ICONS.module;
  }
  return ICONS.cargo;
}

function iconForTreeNode(id: string): string {
  if (id === "ship")           return ICONS.ship;
  if (id === "shipCargo")      return ICONS.cargo;
  if (id === "shipFitting")    return ICONS.fitting;
  if (id === "station")        return ICONS.station;
  if (id === "stationStorage") return ICONS.hangar;
  return ICONS.cargo;
}

let bridgeToastTimeout: ReturnType<typeof setTimeout> | null = null;
function showBridgeToast(msg: string) {
  const el = document.getElementById("bridge-toast");
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  if (bridgeToastTimeout) clearTimeout(bridgeToastTimeout);
  bridgeToastTimeout = setTimeout(() => { el.style.opacity = "0"; }, 2400);
}

// ─── Inventory Tree State ───
export const INV_STATE: InventoryState = {
  selectedTreeId: "shipCargo",
  expanded: new Set(["ship", "shipCargo"]),
  selectedItemId: null,
  filterText: "",
  sortKey: "name",
  sortDir: 1,        // 1 = asc, -1 = desc
  contextMenu: null,
  // Defaults sized to fit the 310px right-side panel (sum ≈ 273px, leaves room
  // for vertical scrollbar + cell borders). Users can resize via column handles.
  colWidths: { name: 130, group: 70, qty: 32, vol: 41 },
};

function getTreeNodes(): TreeNode[] {
  const nodes: TreeNode[] = [];
  const ship = SHIPS[G.P.shipId];

  // Ship branch — single unified cargo hold
  nodes.push({
    id: "ship",
    label: ship.name,
    icon: "◆",
    children: [
      { id: "shipCargo", label: "Cargo Hold", icon: "□" },
      { id: "shipFitting", label: "Fitting", icon: "⚙" },
    ],
  });

  // Station branch (only if docked)
  if (Client.stationOpen && Client.activeStation) {
    nodes.push({
      id: "station",
      label: Client.activeStation.name,
      icon: "⌂",
      children: [
        { id: "stationStorage", label: "Item Hangar", icon: "□" },
      ],
    });
  }

  return nodes;
}

// ─── Normalize Player Data into Items ───
function normalizeItems(): InventoryItem[] {
  const items: InventoryItem[] = [];
  const p = G.P;

  // Ore items (unified cargo hold)
  if (p.ore.iron > 0) items.push({ id: "ore_iron", name: "Iron Ore", group: "Ore", qty: p.ore.iron, vol: 0.3, type: "ore", key: "iron", container: "shipCargo" });
  if (p.ore.crystal > 0) items.push({ id: "ore_crystal", name: "Crystal Ore", group: "Ore", qty: p.ore.crystal, vol: 0.3, type: "ore", key: "crystal", container: "shipCargo" });
  if (p.ore.exotic > 0) items.push({ id: "ore_exotic", name: "Exotic Ore", group: "Ore", qty: p.ore.exotic, vol: 0.4, type: "ore", key: "exotic", container: "shipCargo" });

  // Ammo items (unified cargo hold)
  if (p.ammo.hybrid > 0) items.push({ id: "ammo_hybrid", name: "Hybrid Charges", group: "Ammo", qty: p.ammo.hybrid, vol: 0.01, type: "ammo", key: "hybrid", container: "shipCargo" });
  if (p.ammo.missile > 0) items.push({ id: "ammo_missile", name: "Missile Rounds", group: "Ammo", qty: p.ammo.missile, vol: 0.015, type: "ammo", key: "missile", container: "shipCargo" });

  // Cargo Hold items (refined, loot, components, modules)
  if (p.refined.bar > 0) items.push({ id: "ref_bar", name: "Refined Bar", group: "Refined Material", qty: p.refined.bar, vol: 0.5, type: "refined", key: "bar", container: "shipCargo" });
  if (p.refined.lattice > 0) items.push({ id: "ref_lattice", name: "Crystal Lattice", group: "Refined Material", qty: p.refined.lattice, vol: 0.5, type: "refined", key: "lattice", container: "shipCargo" });
  if (p.refined.condensate > 0) items.push({ id: "ref_condensate", name: "Condensate", group: "Refined Material", qty: p.refined.condensate, vol: 0.6, type: "refined", key: "condensate", container: "shipCargo" });

  if (p.loot.scrap > 0) items.push({ id: "loot_scrap", name: "Scrap Metal", group: "Salvage", qty: p.loot.scrap, vol: 0.2, type: "loot", key: "scrap", container: "shipCargo" });
  if (p.loot.chip > 0) items.push({ id: "loot_chip", name: "Circuit Chip", group: "Salvage", qty: p.loot.chip, vol: 0.05, type: "loot", key: "chip", container: "shipCargo" });
  if (p.loot.cell > 0) items.push({ id: "loot_cell", name: "Power Cell", group: "Salvage", qty: p.loot.cell, vol: 0.08, type: "loot", key: "cell", container: "shipCargo" });

  for (const [k, v] of Object.entries(p.components)) {
    if (v > 0) {
      const nice = k.replace(/_/g, " ");
      items.push({ id: `comp_${k}`, name: nice.charAt(0).toUpperCase() + nice.slice(1), group: "Component", qty: v, vol: 0.1, type: "component", key: k, container: "shipCargo" });
    }
  }

  // Modules in cargo (exclude currently fitted)
  const fittedUids = new Set<string>();
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting[rack];
    if (slots) {
      for (const uid of slots) if (uid) fittedUids.add(uid);
    }
  }

  for (const inst of p.moduleCargo) {
    if (fittedUids.has(inst.uid)) continue;
    const m = MODULES[inst.baseId];
    if (m) {
      const rarityCfg = RARITY_CONFIG[inst.rarity];
      items.push({ id: `mod_${inst.uid}`, name: `${inst.rarity} ${m.name}`, group: m.rack ? `Module (${m.rack})` : "Module", qty: 1, vol: MODULE_HOLD_VOLUME_M3, type: "module", key: inst.uid, container: "shipCargo", meta: m, instance: inst, rarityColor: rarityCfg.color });
    }
  }

  // Fitting items (read-only display)
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting[rack];
    if (slots) {
      for (let i = 0; i < slots.length; i++) {
        const uid = slots[i];
        if (uid) {
          const inst = getInstance(uid);
          if (inst) {
            const m = MODULES[inst.baseId];
            if (m) {
              const rarityCfg = RARITY_CONFIG[inst.rarity];
              items.push({ id: `fit_${rack}_${i}`, name: `${inst.rarity} ${m.name}`, group: `Fitted ${rack}`, qty: 1, vol: MODULE_HOLD_VOLUME_M3, type: "fitting", key: `${rack}:${i}`, container: "shipFitting", meta: m, instance: inst, rarityColor: rarityCfg.color });
            }
          }
        }
      }
    }
  }

  return items;
}

function getItemsForContainer(containerId: string): InventoryItem[] {
  const all = normalizeItems();
  if (containerId === "ship") return [];
  if (containerId === "station") return [];
  return all.filter((it: InventoryItem) => it.container === containerId);
}

function calcVolume(items: InventoryItem[]): number {
  return items.reduce((sum, it) => sum + (it.vol || 0) * (it.qty || 1), 0);
}

// ─── Actions ───
export function jettisonItem(itemId: string, qty: number | null = null) {
  const all = normalizeItems();
  const it = all.find((x: InventoryItem) => x.id === itemId);
  if (!it) return;
  const drop = qty == null ? it.qty : Math.min(qty, it.qty);
  if (drop <= 0) return;

  const res = jettisonItemAction(it.id, drop);
  if (!res.success) return;

  showBridgeToast(`Jettisoned ${drop}× ${it.name}`);
  INV_STATE.selectedItemId = null;
  rerenderInventory();
}

export function splitStack(itemId: string, newQty: number) {
  const all = normalizeItems();
  const it = all.find((x: InventoryItem) => x.id === itemId);
  if (!it || newQty <= 0 || newQty >= it.qty) return;
  // For simplicity in this flat model, splitting just shows a toast since we don't have granular item objects yet.
  showBridgeToast(`Split ${it.name}: ${newQty} / ${it.qty - newQty}`);
}

export function selectTreeNode(nodeId: string) {
  INV_STATE.selectedTreeId = nodeId;
  INV_STATE.selectedItemId = null;
  INV_STATE.contextMenu = null;
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
  if (INV_STATE.contextMenu) {
    INV_STATE.contextMenu = null;
    rerenderInventory();
  }
}

function rerenderInventory() {
  const pane = document.getElementById("bridge-pane-cargo");
  if (pane) pane.innerHTML = renderInventoryHTML();
  attachInventoryListeners();
}

// ─── HTML Renderers ───
export function renderInventoryHTML(): string {
  const nodes = getTreeNodes();
  const treeHTML = renderTreeNodes(nodes);
  const items = getItemsForContainer(INV_STATE.selectedTreeId);
  const filtered = (INV_STATE.filterText
    ? items.filter((it: InventoryItem) => it.name.toLowerCase().includes(INV_STATE.filterText) || it.group.toLowerCase().includes(INV_STATE.filterText))
    : [...items]
  ).sort((a: InventoryItem, b: InventoryItem) => {
    const d = INV_STATE.sortDir;
    switch (INV_STATE.sortKey) {
      case "group": return d * a.group.localeCompare(b.group);
      case "qty":   return d * (a.qty - b.qty);
      case "vol":   return d * ((a.vol || 0) * a.qty - (b.vol || 0) * b.qty);
      default:      return d * a.name.localeCompare(b.name);
    }
  });
  const totalVol = calcVolume(items);
  const capacity = getCapacityFor(INV_STATE.selectedTreeId);
  const pct = capacity > 0 ? Math.min(100, Math.round((totalVol / capacity) * 100)) : 0;
  const selectedItem = normalizeItems().find((it: InventoryItem) => it.id === INV_STATE.selectedItemId);

  return `
    <div class="inv-layout">
      <div class="inv-main" style="width: 100%;">
        <div class="inv-toolbar">
          <input type="text" class="inv-filter" placeholder="Filter items…" value="${escHtml(INV_STATE.filterText)}" id="inv-filter-input" />
        </div>
        <div class="inv-table-wrap">
          <table class="inv-table">
            <thead>
              <tr>
                ${(["name","group","qty","vol"] as const).map((k, i) => {
                  const labels = ["Name","Group","Qty","Volume"];
                  const ind = INV_STATE.sortKey === k ? (INV_STATE.sortDir === 1 ? " ↑" : " ↓") : "";
                  const cls = ["inv-col-name","inv-col-group","inv-col-qty","inv-col-vol"][i];
                  const w = INV_STATE.colWidths[k];
                  return `<th class="${cls} inv-sortable" data-sort="${k}" style="width:${w}px">${labels[i]}${ind}<div class="inv-col-resizer" data-col="${k}"></div></th>`;
                }).join("")}
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((it: InventoryItem) => renderItemRow(it)).join("") : `<tr><td colspan="4" class="inv-empty">Empty</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="inv-footer">
          <div class="inv-cap-bar-wrap" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <div class="inv-cap-bar" style="flex: 1; margin-bottom: 0;"><div class="inv-cap-fill" style="width:${pct}%"></div></div>
            <span class="inv-cap-label">${totalVol.toFixed(1)} / ${capacity.toFixed(1)} m³ (${pct}%)</span>
          </div>
          <div class="inv-selection">
            ${selectedItem ? `<b>${escHtml(selectedItem.name)}</b> <span class="inv-sel-meta">${escHtml(selectedItem.group)} · ${selectedItem.vol.toFixed(2)} m³</span>` : "No selection"}
          </div>
        </div>
      </div>
    </div>
    ${renderContextMenu()}
  `;
}

function renderTreeNodes(nodes: TreeNode[], depth: number = 0): string {
  return nodes.map((n: TreeNode) => {
    const isExpanded = INV_STATE.expanded.has(n.id);
    const isSelected = INV_STATE.selectedTreeId === n.id;
    const hasChildren = n.children && n.children.length > 0;
    const arrow = hasChildren ? (isExpanded ? "▼" : "▶") : "<span class='inv-tree-spacer'></span>";
    const indent = depth * 12;
    let html = `<div class="inv-tree-node ${isSelected ? "is-selected" : ""}" data-node="${n.id}" style="padding-left:${8 + indent}px">
      <span class="inv-tree-arrow">${arrow}</span>
      <span class="inv-tree-icon">${iconForTreeNode(n.id)}</span>
      <span class="inv-tree-label">${escHtml(n.label)}</span>
    </div>`;
    if (hasChildren && isExpanded && n.children) {
      html += `<div class="inv-tree-children">${renderTreeNodes(n.children, depth + 1)}</div>`;
    }
    return html;
  }).join("");
}

function renderItemRow(it: InventoryItem): string {
  const isSel = INV_STATE.selectedItemId === it.id;
  return `<tr class="inv-table-row ${isSel ? "is-selected" : ""}" data-item="${it.id}">
    <td class="inv-col-name"><span class="inv-item-name-cell">${itemIcon(it)}<span>${escHtml(it.name)}</span></span></td>
    <td class="inv-col-group">${escHtml(it.group)}</td>
    <td class="inv-col-qty">${it.qty.toLocaleString()}</td>
    <td class="inv-col-vol">${((it.vol || 0) * it.qty).toFixed(2)}</td>
  </tr>`;
}

function itemIcon(it: InventoryItem): string {
  return iconForItem(it);
}

function getCapacityFor(containerId: string): number {
  const ship = SHIPS[G.P.shipId];
  if (containerId === "shipCargo") return ship.baseCargoM3 || 100;
  if (containerId === "shipFitting") return 0; // Fitting is slots, not volume
  if (containerId === "stationStorage") return 10000;
  return 100;
}

function renderContextMenu(): string {
  if (!INV_STATE.contextMenu) return "";
  const { x, y, itemId } = INV_STATE.contextMenu;
  const all = normalizeItems();
  const it = all.find((i: InventoryItem) => i.id === itemId);
  if (!it) return "";
  const items: { action: string; label: string }[] = [];
  if (it.container !== "shipFitting") {
    items.push({ action: "jettison", label: "Jettison" });
    if (it.qty > 1) items.push({ action: "split", label: "Split Stack…" });
  }
  items.push({ action: "info", label: "Show Info" });

  return `<div class="inv-ctx" style="left:${x}px;top:${y}px">
    ${items.map((mi) => `<div class="inv-ctx-item" data-action="${mi.action}" data-item="${itemId}">${escHtml(mi.label)}</div>`).join("")}
  </div>`;
}

// ─── Event Attachment ───
let _paneClickAttached = false;

export function attachInventoryListeners() {
  const pane = document.getElementById("bridge-pane-cargo");
  if (!pane) return;

  // Tree clicks
  for (const nodeEl of pane.querySelectorAll(".inv-tree-node")) {
    nodeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      sfxBlip(660, 0.04);
      const id = (nodeEl as HTMLElement).dataset.node;
      const nodes = getTreeNodes();
      const hasChildren = (id ? findNode(nodes, id)?.children?.length ?? 0 : 0) > 0;
      if (hasChildren && id) toggleTreeNode(id);
      if (id) selectTreeNode(id);
    });
  }

  // Item row clicks
  for (const row of pane.querySelectorAll(".inv-table-row")) {
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      sfxBlip(720, 0.04);
      selectItem((row as HTMLElement).dataset.item || null);
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showItemContextMenu((row as HTMLElement).dataset.item!, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
    });
  }

  // Column sort headers
  for (const th of pane.querySelectorAll(".inv-sortable")) {
    th.addEventListener("click", (e) => {
      // Ignore clicks on the resizer
      if ((e.target as HTMLElement).classList.contains("inv-col-resizer")) return;
      const key = (th as HTMLElement).dataset.sort as "name" | "group" | "qty" | "vol";
      if (INV_STATE.sortKey === key) {
        INV_STATE.sortDir = (INV_STATE.sortDir * -1) as 1 | -1;
      } else {
        INV_STATE.sortKey = key;
        INV_STATE.sortDir = 1;
      }
      sfxBlip(640, 0.04);
      rerenderInventory();
    });
  }

  // Column resizing
  let isResizing = false;
  let currentResizer: HTMLElement | null = null;
  let startX = 0;
  let startWidth = 0;
  let currentKey: "name" | "group" | "qty" | "vol" | "" = "";

  for (const resizer of pane.querySelectorAll(".inv-col-resizer")) {
    resizer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent text selection
      isResizing = true;
      currentResizer = resizer as HTMLElement;
      currentKey = currentResizer.dataset.col as "name" | "group" | "qty" | "vol";
      startX = (e as MouseEvent).clientX;
      startWidth = INV_STATE.colWidths[currentKey] || 50;
      
      const onMove = (mv: MouseEvent) => {
        if (!isResizing || !currentKey) return;
        const diffX = mv.clientX - startX;
        let newWidth = Math.max(28, Math.min(200, startWidth + diffX)); // Clamp 28-200px
        INV_STATE.colWidths[currentKey] = newWidth;
        const th = currentResizer!.closest("th");
        if (th) th.style.width = `${newWidth}px`;
      };
      
      const onUp = () => {
        if (isResizing) {
          isResizing = false;
          currentResizer = null;
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // Filter input
  const filterInput = pane.querySelector("#inv-filter-input");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      setFilter((e.target as HTMLInputElement).value);
    });
    filterInput.addEventListener("keydown", (e) => e.stopPropagation());
  }

  // Context menu actions
  for (const ctx of pane.querySelectorAll(".inv-ctx-item")) {
    ctx.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = (ctx as HTMLElement).dataset.action;
      const itemId = (ctx as HTMLElement).dataset.item;
      if (action === "jettison") { sfxConfirm(); jettisonItem(itemId!); }
      else if (action === "split") {
        const all = normalizeItems();
        const it = all.find((i: InventoryItem) => i.id === itemId);
        if (it && it.qty > 1) {
          sfxConfirm();
          const half = Math.floor(it.qty / 2);
          splitStack(itemId!, half);
        }
      } else if (action === "info") {
        sfxBlip();
        const all = normalizeItems();
        const it = all.find((i: InventoryItem) => i.id === itemId);
        if (it) showBridgeToast(`${it.name} — ${it.group} (${it.qty})`);
      }
      closeContextMenu();
    });
  }

  // Close context menu on click elsewhere (attach once)
  if (!_paneClickAttached) {
    _paneClickAttached = true;
    pane.addEventListener("click", () => {
      closeContextMenu();
    });
  }
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ─── Public API for Bridge ───
export function resetInventoryUI() {
  INV_STATE.selectedTreeId = "shipCargo";
  INV_STATE.expanded = new Set(["ship", "shipCargo"]);
  INV_STATE.selectedItemId = null;
  INV_STATE.filterText = "";
  INV_STATE.contextMenu = null;
}
