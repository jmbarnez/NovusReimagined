import type { ContainerLayout, GridPosition } from "./state.js";

const LAYOUT_PREFIX = "novus-inv-grid-";

const _layouts = new Map<string, ContainerLayout>();

function getStorageKey(containerId: string): string {
  return `${LAYOUT_PREFIX}${containerId}`;
}

function loadLayoutFromStorage(containerId: string): ContainerLayout | null {
  try {
    const raw = localStorage.getItem(getStorageKey(containerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.positions)) {
      return parsed as ContainerLayout;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveLayoutToStorage(containerId: string, layout: ContainerLayout): void {
  try {
    localStorage.setItem(getStorageKey(containerId), JSON.stringify(layout));
  } catch {
    // Ignore storage errors
  }
}

export function getLayout(containerId: string): ContainerLayout {
  if (_layouts.has(containerId)) {
    return _layouts.get(containerId)!;
  }

  const saved = loadLayoutFromStorage(containerId);
  if (saved) {
    _layouts.set(containerId, saved);
    return saved;
  }

  const empty: ContainerLayout = { positions: [], nextSlot: 0 };
  _layouts.set(containerId, empty);
  return empty;
}

export function setLayout(containerId: string, layout: ContainerLayout): void {
  _layouts.set(containerId, layout);
  saveLayoutToStorage(containerId, layout);
}

export function getPosition(containerId: string, itemId: string): number | null {
  const layout = getLayout(containerId);
  const pos = layout.positions.find(p => p.itemId === itemId);
  return pos ? pos.slotIndex : null;
}

export function removePosition(containerId: string, itemId: string): void {
  const layout = getLayout(containerId);
  const newPositions = layout.positions.filter(p => p.itemId !== itemId);
  if (newPositions.length === layout.positions.length) return;

  setLayout(containerId, { ...layout, positions: newPositions });
}

export function mergeLayoutWithItems(containerId: string, itemIds: string[]): void {
  const layout = getLayout(containerId);
  const itemIdSet = new Set(itemIds);

  // Keep positions for items that still exist, preserving relative order
  const existingPositions = layout.positions.filter(p => itemIdSet.has(p.itemId));
  const existingIds = new Set(existingPositions.map(p => p.itemId));

  // Append new items at the end
  let newPositions = [...existingPositions];
  for (const itemId of itemIds) {
    if (!existingIds.has(itemId)) {
      newPositions.push({ itemId, slotIndex: newPositions.length });
    }
  }

  // Renumber to dense 0..n-1, preserving relative order
  newPositions = newPositions.map((p, i) => ({ ...p, slotIndex: i }));

  // Only persist if something changed
  if (newPositions.length !== layout.positions.length ||
      newPositions.some((p, i) => p.itemId !== layout.positions[i]?.itemId || p.slotIndex !== layout.positions[i]?.slotIndex)) {
    setLayout(containerId, { positions: newPositions, nextSlot: newPositions.length });
  }
}

export function swapItems(containerId: string, slotA: number, slotB: number): void {
  if (slotA === slotB) return;
  const layout = getLayout(containerId);
  const idxA = layout.positions.findIndex(p => p.slotIndex === slotA);
  const idxB = layout.positions.findIndex(p => p.slotIndex === slotB);
  if (idxA < 0 || idxB < 0) return;

  const newPositions = [...layout.positions];
  newPositions[idxA] = { ...newPositions[idxA], slotIndex: slotB };
  newPositions[idxB] = { ...newPositions[idxB], slotIndex: slotA };
  setLayout(containerId, { positions: newPositions, nextSlot: newPositions.length });
}

export function insertItem(containerId: string, fromSlot: number, toVisualIndex: number): void {
  const layout = getLayout(containerId);
  const fromIdx = layout.positions.findIndex(p => p.slotIndex === fromSlot);
  if (fromIdx < 0) return;

  const moving = layout.positions[fromIdx];
  const remaining = layout.positions.filter((_, i) => i !== fromIdx);
  const insertAt = Math.max(0, Math.min(toVisualIndex, remaining.length));

  const reordered = [
    ...remaining.slice(0, insertAt),
    moving,
    ...remaining.slice(insertAt),
  ];

  const newPositions = reordered.map((p, i) => ({ ...p, slotIndex: i }));
  setLayout(containerId, { positions: newPositions, nextSlot: newPositions.length });
}

export function moveItemInGrid(containerId: string, fromSlot: number, toSlot: number): void {
  if (fromSlot === toSlot) return;

  const layout = getLayout(containerId);
  const fromIdx = layout.positions.findIndex(p => p.slotIndex === fromSlot);
  if (fromIdx < 0) return;

  const toIdx = layout.positions.findIndex(p => p.slotIndex === toSlot);

  const newPositions = [...layout.positions];

  if (toIdx >= 0) {
    // Swap two items
    const fromItem = { ...newPositions[fromIdx], slotIndex: toSlot };
    const toItem = { ...newPositions[toIdx], slotIndex: fromSlot };
    newPositions[fromIdx] = fromItem;
    newPositions[toIdx] = toItem;
  } else {
    // Move to empty slot
    newPositions[fromIdx] = { ...newPositions[fromIdx], slotIndex: toSlot };
  }

  const maxSlot = newPositions.length > 0 ? Math.max(...newPositions.map(p => p.slotIndex)) : 0;
  setLayout(containerId, { positions: newPositions, nextSlot: maxSlot + 1 });
}

export function clearLayout(containerId: string): void {
  _layouts.delete(containerId);
  try {
    localStorage.removeItem(getStorageKey(containerId));
  } catch {
    // Ignore storage errors
  }
}
