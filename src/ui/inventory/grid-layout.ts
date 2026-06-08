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

function nextAvailableSlot(positions: GridPosition[]): number {
  const used = new Set(positions.map(p => p.slotIndex));
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}

export function mergeLayoutWithItems(containerId: string, itemIds: string[]): void {
  const layout = getLayout(containerId);
  const itemIdSet = new Set(itemIds);

  // Keep positions for items that still exist
  const existingPositions = layout.positions.filter(p => itemIdSet.has(p.itemId));
  const existingIds = new Set(existingPositions.map(p => p.itemId));

  // Add new items at the next available slot
  let newPositions = [...existingPositions];
  for (const itemId of itemIds) {
    if (!existingIds.has(itemId)) {
      const slot = nextAvailableSlot(newPositions);
      newPositions.push({ itemId, slotIndex: slot });
    }
  }

  // Only persist if something changed
  if (newPositions.length !== layout.positions.length ||
      newPositions.some((p, i) => p.itemId !== layout.positions[i]?.itemId || p.slotIndex !== layout.positions[i]?.slotIndex)) {
    const maxSlot = newPositions.length > 0 ? Math.max(...newPositions.map(p => p.slotIndex)) : 0;
    setLayout(containerId, { positions: newPositions, nextSlot: maxSlot + 1 });
  }
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
