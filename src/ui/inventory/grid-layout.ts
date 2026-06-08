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

function computeNextSlot(layout: ContainerLayout): number {
  if (layout.positions.length === 0) return 0;
  return Math.max(...layout.positions.map(p => p.slotIndex)) + 1;
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

export function setPosition(containerId: string, itemId: string, slotIndex: number): void {
  const layout = getLayout(containerId);
  const existingIndex = layout.positions.findIndex(p => p.itemId === itemId);

  let newPositions: GridPosition[];
  if (existingIndex >= 0) {
    newPositions = layout.positions.map((p, i) =>
      i === existingIndex ? { ...p, slotIndex } : p
    );
  } else {
    newPositions = [...layout.positions, { itemId, slotIndex }];
  }

  const newLayout: ContainerLayout = {
    ...layout,
    positions: newPositions,
    nextSlot: computeNextSlot({ ...layout, positions: newPositions }),
  };

  setLayout(containerId, newLayout);
}

export function removePosition(containerId: string, itemId: string): void {
  const layout = getLayout(containerId);
  const newPositions = layout.positions.filter(p => p.itemId !== itemId);
  if (newPositions.length === layout.positions.length) return;

  const newLayout: ContainerLayout = {
    ...layout,
    positions: newPositions,
  };

  setLayout(containerId, newLayout);
}

export function assignNextSlot(containerId: string, itemId: string): number {
  const layout = getLayout(containerId);
  const usedSlots = new Set(layout.positions.map(p => p.slotIndex));
  let slotIndex = 0;
  while (usedSlots.has(slotIndex)) slotIndex++;
  setPosition(containerId, itemId, slotIndex);
  return slotIndex;
}

function lowestEmptySlot(positions: GridPosition[]): number {
  const used = new Set(positions.map(p => p.slotIndex));
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}

function compactPositions(positions: GridPosition[]): GridPosition[] {
  const sorted = [...positions].sort((a, b) => a.slotIndex - b.slotIndex);
  return sorted.map((p, i) => ({ ...p, slotIndex: i }));
}

export function mergeLayoutWithItems(containerId: string, itemIds: string[]): void {
  const layout = getLayout(containerId);
  const itemIdSet = new Set(itemIds);

  const filteredPositions = layout.positions.filter(p => itemIdSet.has(p.itemId));
  const positionedIds = new Set(filteredPositions.map(p => p.itemId));

  let newPositions: GridPosition[] = [...filteredPositions];

  for (const itemId of itemIds) {
    if (!positionedIds.has(itemId)) {
      newPositions.push({ itemId, slotIndex: newPositions.length });
    }
  }

  newPositions = compactPositions(newPositions);

  const positionsChanged = newPositions.length !== layout.positions.length ||
    newPositions.some((p, i) => p.itemId !== layout.positions[i]?.itemId || p.slotIndex !== layout.positions[i]?.slotIndex);

  if (positionsChanged) {
    const newLayout: ContainerLayout = {
      positions: newPositions,
      nextSlot: newPositions.length,
    };
    setLayout(containerId, newLayout);
  }
}

export function clearLayout(containerId: string): void {
  _layouts.delete(containerId);
  try {
    localStorage.removeItem(getStorageKey(containerId));
  } catch {
    // Ignore storage errors
  }
}
