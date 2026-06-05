import { getState } from "../../state-access.js";
import { ORE, LOOT, COMPONENTS } from "../../data/resources.js";
import { MODULES } from "../../data/modules.js";
import { escHtml } from "../../utils/format.js";
import { itemIconHtml as atlasItemIconHtml } from "../icons/item-icon-bake.js";
import { t } from "../../utils/i18n.js";
import { dominantOreKey } from "../../utils/ore-naming.js";
import { INV_STATE, type InventoryItem, type TreeNode } from "./state.js";
import { calcVolume, getCapacityFor, getItemsForContainer, normalizeItems } from "./tree.js";

const ICON_SIZE = 32;
const ICON_SIZE_SM = 20;
const ICON_SIZE_GRID = 52;

/** Map an InventoryItem to the key used by the icon atlas / baker. */
function iconKeyForItem(it: InventoryItem): string {
  if (it.type === "ore") return it.key;
  if (it.type === "mixedOre") return dominantOreKey(it.composition ?? { [it.key]: 1 });
  if (it.type === "material") return dominantOreKey(it.composition ?? { [it.key]: 1 });
  if (it.type === "loot") return it.key;
  if (it.type === "component") return it.key;
  if (it.type === "ammo") return `ammo-${it.key}`;
  if (it.type === "module" || it.type === "fitting") return it.meta?.id ?? "";
  return "";
}

/** Resolve the accent color for an InventoryItem from resource defs. */
export function colorForItem(it: InventoryItem): string | undefined {
  if (it.rarityColor) return it.rarityColor;
  if (it.type === "ore") return ORE[it.key]?.color;
  if (it.type === "mixedOre") return ORE[dominantOreKey(it.composition ?? { [it.key]: 1 })]?.color;
  if (it.type === "material") return ORE[dominantOreKey(it.composition ?? { [it.key]: 1 })]?.color;
  if (it.type === "loot") return LOOT[it.key]?.color;
  if (it.type === "component") return COMPONENTS[it.key]?.color;
  return undefined;
}

export function itemIconHtml(it: InventoryItem, size: number = ICON_SIZE): string {
  return atlasItemIconHtml(iconKeyForItem(it), size);
}

export function itemIconSmall(it: InventoryItem): string {
  return atlasItemIconHtml(iconKeyForItem(it), ICON_SIZE_SM);
}

export function renderInventoryHTML(): string {
  const items = getItemsForContainer(INV_STATE.selectedTreeId);
  const filtered = (INV_STATE.filterText
    ? items.filter((it) => it.name.toLowerCase().includes(INV_STATE.filterText) || it.group.toLowerCase().includes(INV_STATE.filterText))
    : [...items]
  ).sort((a, b) => {
    const d = INV_STATE.sortDir;
    switch (INV_STATE.sortKey) {
      case "group": return d * a.group.localeCompare(b.group);
      case "qty": return d * (a.qty - b.qty);
      case "vol": return d * ((a.vol || 0) * a.qty - (b.vol || 0) * b.qty);
      default: return d * a.name.localeCompare(b.name);
    }
  });
  const totalVol = calcVolume(items);
  const capacity = getCapacityFor(INV_STATE.selectedTreeId);
  const pct = capacity > 0 ? Math.min(100, Math.round((totalVol / capacity) * 100)) : 0;
  const selectedItem = normalizeItems().find((it) => it.id === INV_STATE.selectedItemId);

  const sortLabels: Record<string, string> = { name: t("inventory.sortName"), group: t("inventory.sortType"), qty: t("inventory.sortQty"), vol: t("inventory.sortVol") };
  const sortArrow = INV_STATE.sortDir === 1 ? "↑" : "↓";
  const isGrid = INV_STATE.viewMode === "grid";
  const wrapClass = isGrid ? "inv-grid-wrap" : "inv-list-wrap";
  const renderItem = isGrid ? renderItemGridCell : renderItemRow;
  const itemsHtml = filtered.length
    ? filtered.map((it) => renderItem(it)).join("")
    : `<div class="inv-empty">${t("inventory.empty")}</div>`;

  return `
    <div class="inv-layout">
      <div class="inv-main" style="width: 100%;">
        <div class="inv-toolbar">
          <div class="inv-view-toggle">
            <button type="button" class="inv-view-btn ${isGrid ? "is-active" : ""}" data-view="grid" title="${t("inventory.gridView")}">▦</button>
            <button type="button" class="inv-view-btn ${!isGrid ? "is-active" : ""}" data-view="list" title="${t("inventory.listView")}">☰</button>
          </div>
          <input type="text" class="inv-filter inv-filter-input" placeholder="${t("inventory.filter")}" value="${escHtml(INV_STATE.filterText)}" />
          <button class="inv-sort-btn" data-sort-cycle="1" title="${t("inventory.sortBy", { label: sortLabels[INV_STATE.sortKey] })}">${sortLabels[INV_STATE.sortKey]} ${sortArrow}</button>
        </div>
        <div class="${wrapClass}">
          ${itemsHtml}
        </div>
        <div class="inv-footer">
          <div class="inv-cap-bar-wrap">
            <div class="inv-cap-bar"><div class="inv-cap-fill" style="width:${pct}%"></div></div>
            <span class="inv-cap-label">${totalVol.toFixed(1)} / ${capacity.toFixed(1)} m³ (${pct}%)</span>
          </div>
          <div class="inv-credits">
            <span class="inv-credits-label">${t("inventory.credits")}</span>
            <span class="inv-credits-value">${Math.floor(getState().player.credits).toLocaleString()}¢</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

const TREE_ICONS: Record<string, string> = {
  ship: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,2 13,12 3,12"/></svg>`,
  shipCargo: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 7h12"/></svg>`,
  shipFitting: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="5"/><path d="M8 3v10M3 8h10"/></svg>`,
  station: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 13V7l4-3 4 3v6"/><path d="M2 13h12"/></svg>`,
  stationStorage: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="9" width="12" height="5" rx="1"/><rect x="4" y="4" width="8" height="5" rx="1"/></svg>`,
};

export function renderTreeNodes(nodes: TreeNode[], depth: number = 0): string {
  return nodes.map((n) => {
    const isExpanded = INV_STATE.expanded.has(n.id);
    const isSelected = INV_STATE.selectedTreeId === n.id;
    const hasChildren = n.children && n.children.length > 0;
    const arrow = hasChildren ? (isExpanded ? "▼" : "▶") : "<span class='inv-tree-spacer'></span>";
    const indent = depth * 12;
    const treeIcon = TREE_ICONS[n.id] ?? TREE_ICONS.shipCargo;
    let html = `<div class="inv-tree-node ${isSelected ? "is-selected" : ""}" data-node="${n.id}" style="padding-left:${8 + indent}px">
      <span class="inv-tree-arrow">${arrow}</span>
      <span class="inv-tree-icon">${treeIcon}</span>
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
  const nameColor = it.rarityColor ?? "var(--hud-text-bright)";
  const accentColor = colorForItem(it);
  const qtyStr = it.qty > 1 ? it.qty.toLocaleString() : "";
  const volStr = ((it.vol || 0) * it.qty).toFixed(1);
  const accentStyle = accentColor ? ` style="color:${accentColor}"` : "";
  const borderStyle = it.rarityColor ? ` style="border-left:2px solid ${it.rarityColor}"` : "";
  return `<div class="inv-item inv-item-row ${isSel ? "is-selected" : ""}" data-item="${it.id}"${borderStyle}>
    <div class="inv-item-icon"${accentStyle}>${itemIconHtml(it)}</div>
    <div class="inv-item-body">
      <div class="inv-item-name" style="color:${nameColor}">${escHtml(it.name)}</div>
      <div class="inv-item-sub">${escHtml(it.group)} · ${volStr} m³</div>
    </div>
    ${qtyStr ? `<div class="inv-item-qty">${qtyStr}</div>` : ""}
  </div>`;
}

function renderItemGridCell(it: InventoryItem): string {
  const isSel = INV_STATE.selectedItemId === it.id;
  const accentColor = colorForItem(it);
  const qtyStr = it.qty > 1 ? it.qty.toLocaleString() : "";
  const accentStyle = accentColor ? ` style="color:${accentColor}"` : "";
  const borderStyle = it.rarityColor ? ` style="border-left:2px solid ${it.rarityColor}"` : "";
  return `<div class="inv-item inv-grid-cell ${isSel ? "is-selected" : ""}" data-item="${it.id}"${borderStyle}>
    <div class="inv-grid-icon"${accentStyle}>${itemIconHtml(it, ICON_SIZE_GRID)}</div>
    ${qtyStr ? `<span class="inv-grid-qty">${qtyStr}</span>` : ""}
  </div>`;
}
