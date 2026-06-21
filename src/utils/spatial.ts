import { getState } from "../state-access.js";
import { getPlayerColRadius, getEnemyColRadius } from "./collision-helpers.js";
import { getAsteroidColRadius } from "./asteroid-helpers.js";
import type { System } from "../types/system.js";

// ─── Spatial grid performance telemetry ─────────────────────────────────────
interface SpatialGridPerf {
  lastSyncMs: number;
  lastRebuildMs: number;
  syncHistory: number[];
  rebuildHistory: number[];
}

const _perf: SpatialGridPerf = {
  lastSyncMs: 0,
  lastRebuildMs: 0,
  syncHistory: [],
  rebuildHistory: [],
};

const MAX_PERF_SAMPLES = 30;

function recordSyncTime(ms: number) {
  _perf.lastSyncMs = ms;
  _perf.syncHistory.push(ms);
  if (_perf.syncHistory.length > MAX_PERF_SAMPLES) _perf.syncHistory.shift();
}

function recordRebuildTime(ms: number) {
  _perf.lastRebuildMs = ms;
  _perf.rebuildHistory.push(ms);
  if (_perf.rebuildHistory.length > MAX_PERF_SAMPLES) _perf.rebuildHistory.shift();
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function getSpatialGridPerf() {
  return {
    lastSyncMs: _perf.lastSyncMs,
    lastRebuildMs: _perf.lastRebuildMs,
    avgSyncMs: avg(_perf.syncHistory),
    avgRebuildMs: avg(_perf.rebuildHistory),
    syncSamples: _perf.syncHistory.length,
    rebuildSamples: _perf.rebuildHistory.length,
  };
}

export interface SpatialEntity<T = unknown> {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: string;
  data: T;
}

export interface SpatialQueryResult<T = unknown> {
  id: string;
  dist: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
  radius: number;
  type: string;
  data: T;
}

export class SpatialGrid {
  cellSize: number;
  cells: Map<number, Set<string>>;
  entities: Map<string, SpatialEntity>;

  constructor(cellSize = 128) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.entities = new Map();
    this._seen = new Set();
  }

  clear() {
    for (const s of this.cells.values()) s.clear();
    this.entities.clear();
  }

  private _key(cx: number, cy: number): number {
    return (cx + 0x8000) | ((cy + 0x8000) << 16);
  }

  insert(id: string, x: number, y: number, radius: number, type = "generic", data: unknown = null) {
    this.entities.set(id, { id, x, y, radius, type, data });
    const cs = this.cellSize;
    const minCX = Math.floor((x - radius) / cs);
    const maxCX = Math.floor((x + radius) / cs);
    const minCY = Math.floor((y - radius) / cs);
    const maxCY = Math.floor((y + radius) / cs);
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const k = this._key(cx, cy);
        let s = this.cells.get(k);
        if (!s) { s = new Set(); this.cells.set(k, s); }
        s.add(id);
      }
    }
  }

  // Reusable set to avoid duplicate results when entities span multiple cells
  private _seen: Set<string>;

  query<T = unknown>(x: number, y: number, radius: number, typeFilter: string | null = null, out: SpatialQueryResult<T>[] | null = null): SpatialQueryResult<T>[] {
    const results = out || [];
    const seen = this._seen;
    seen.clear();
    const cs = this.cellSize;
    const minCX = Math.floor((x - radius) / cs);
    const maxCX = Math.floor((x + radius) / cs);
    const minCY = Math.floor((y - radius) / cs);
    const maxCY = Math.floor((y + radius) / cs);
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const s = this.cells.get(this._key(cx, cy));
        if (!s) continue;
        for (const id of s) {
          if (seen.has(id)) continue;
          seen.add(id);
          const e = this.entities.get(id);
          if (!e) continue;
          if (typeFilter && e.type !== typeFilter) continue;
          const dx = e.x - x, dy = e.y - y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius + e.radius) {
            results.push({ dist, dx, dy, ...e } as SpatialQueryResult<T>);
          }
        }
      }
    }
    return results;
  }

  queryAll<T = unknown>(typeFilter: string | null = null): SpatialQueryResult<T>[] {
    const results: SpatialQueryResult<T>[] = [];
    for (const [, e] of this.entities) {
      if (typeFilter && e.type !== typeFilter) continue;
      results.push({ dist: 0, dx: 0, dy: 0, ...e } as SpatialQueryResult<T>);
    }
    return results;
  }

  // Incremental update methods
  remove(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Remove from all cells the entity spans
    const cs = this.cellSize;
    const minCX = Math.floor((entity.x - entity.radius) / cs);
    const maxCX = Math.floor((entity.x + entity.radius) / cs);
    const minCY = Math.floor((entity.y - entity.radius) / cs);
    const maxCY = Math.floor((entity.y + entity.radius) / cs);

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const k = this._key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) {
          cell.delete(id);
          // Clean up empty cells to prevent memory bloat
          if (cell.size === 0) {
            this.cells.delete(k);
          }
        }
      }
    }

    this.entities.delete(id);
    return true;
  }

  update(id: string, newX: number, newY: number, newRadius?: number): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    const oldRadius = entity.radius;
    const radiusChanged = newRadius !== undefined && newRadius !== oldRadius;
    const newRadiusFinal = newRadius ?? oldRadius;

    // Check if entity moved to different cells
    const cs = this.cellSize;
    const oldMinCX = Math.floor((entity.x - oldRadius) / cs);
    const oldMaxCX = Math.floor((entity.x + oldRadius) / cs);
    const oldMinCY = Math.floor((entity.y - oldRadius) / cs);
    const oldMaxCY = Math.floor((entity.y + oldRadius) / cs);

    const newMinCX = Math.floor((newX - newRadiusFinal) / cs);
    const newMaxCX = Math.floor((newX + newRadiusFinal) / cs);
    const newMinCY = Math.floor((newY - newRadiusFinal) / cs);
    const newMaxCY = Math.floor((newY + newRadiusFinal) / cs);

    // If position and radius haven't changed cell boundaries, just update entity data
    if (!radiusChanged &&
        oldMinCX === newMinCX && oldMaxCX === newMaxCX &&
        oldMinCY === newMinCY && oldMaxCY === newMaxCY) {
      entity.x = newX;
      entity.y = newY;
      return true;
    }

    // Remove from old cells
    for (let cy = oldMinCY; cy <= oldMaxCY; cy++) {
      for (let cx = oldMinCX; cx <= oldMaxCX; cx++) {
        const k = this._key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) {
          cell.delete(id);
          if (cell.size === 0) {
            this.cells.delete(k);
          }
        }
      }
    }

    // Update entity data
    entity.x = newX;
    entity.y = newY;
    entity.radius = newRadiusFinal;

    // Add to new cells
    for (let cy = newMinCY; cy <= newMaxCY; cy++) {
      for (let cx = newMinCX; cx <= newMaxCX; cx++) {
        const k = this._key(cx, cy);
        let cell = this.cells.get(k);
        if (!cell) {
          cell = new Set();
          this.cells.set(k, cell);
        }
        cell.add(id);
      }
    }

    return true;
  }

  updateEntityData(id: string, data: unknown): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;
    entity.data = data;
    return true;
  }

  has(id: string): boolean {
    return this.entities.has(id);
  }

  get(id: string): SpatialEntity | undefined {
    return this.entities.get(id);
  }

  // Performance metrics
  getStats() {
    return {
      entityCount: this.entities.size,
      cellCount: this.cells.size,
      averageEntitiesPerCell: this.entities.size / Math.max(1, this.cells.size),
      memoryUsage: this.cells.size * 8 + this.entities.size * 64 // Rough estimate
    };
  }
}

function resolveSpatialSystem(sysIdx?: number): System | null {
  const state = getState();
  const idx = sysIdx ?? state.player?.sysIdx ?? 0;
  return state.GALAXY[idx] || state.GALAXY[0] || null;
}

export function rebuildSpatialGrid(sysIdx?: number) {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const grid = getState().spatialGrid;
  if (!grid) return;
  grid.clear();
  const sys = resolveSpatialSystem(sysIdx);
  if (!sys) return;

  if (!sys.liveEnemies) sys.liveEnemies = [];
  if (!sys.liveAsteroids) sys.liveAsteroids = [];
  let le = 0, la = 0;
  for (const e of sys.enemies) if (e.alive) sys.liveEnemies[le++] = e;
  sys.liveEnemies.length = le;
  for (const a of sys.asteroids) if (!a.depleted && a.hp > 0) sys.liveAsteroids[la++] = a;
  sys.liveAsteroids.length = la;

  for (const p of getState().players.values()) {
    if (p.sysIdx !== sys.idx) continue;
    const playerColRadius = getPlayerColRadius(p.shipId);
    grid.insert(p.netId ?? "__player", p.x, p.y, playerColRadius, "player", p);
  }

  for (const e of sys.liveEnemies) {
    const enemyColRadius = getEnemyColRadius(e.type);
    grid.insert(e.id, e.x, e.y, enemyColRadius, "enemy", e);
  }

  for (const a of sys.liveAsteroids) {
    grid.insert(a.id, a.x, a.y, getAsteroidColRadius(a), "asteroid", a);
  }

  for (const s of sys.stations) {
    grid.insert(s.id, s.x, s.y, s.radius, "station", s);
  }

  for (const p of getState().wreckPieces) {
    if (p.hp > 0) grid.insert(p.id, p.x, p.y, p.radius, "wreckpiece", p);
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : 0;
  recordRebuildTime(t1 - t0);
}

/**
 * Incrementally syncs the spatial grid without clearing it.
 * Removes dead/missing entities, updates positions of existing ones,
 * and inserts newly spawned entities. Much cheaper than a full rebuild
 * when the entity set is mostly stable.
 */
export function syncSpatialGrid(sysIdx?: number) {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const grid = getState().spatialGrid;
  if (!grid) return;
  const sys = resolveSpatialSystem(sysIdx);
  if (!sys) return;

  const expectedIds = new Set<string>();

  for (const p of getState().players.values()) {
    if (p.sysIdx !== sys.idx) continue;
    const id = p.netId ?? "__player";
    expectedIds.add(id);
    const playerColRadius = getPlayerColRadius(p.shipId);
    if (grid.has(id)) {
      grid.update(id, p.x, p.y, playerColRadius);
    } else {
      grid.insert(id, p.x, p.y, playerColRadius, "player", p);
    }
  }

  for (const e of sys.enemies) {
    if (!e.alive) continue;
    expectedIds.add(e.id);
    const enemyColRadius = getEnemyColRadius(e.type);
    if (grid.has(e.id)) {
      grid.update(e.id, e.x, e.y, enemyColRadius);
    } else {
      grid.insert(e.id, e.x, e.y, enemyColRadius, "enemy", e);
    }
  }

  for (const a of sys.asteroids) {
    if (a.depleted || a.hp <= 0) continue;
    expectedIds.add(a.id);
    const colR = getAsteroidColRadius(a);
    if (grid.has(a.id)) {
      grid.update(a.id, a.x, a.y, colR);
    } else {
      grid.insert(a.id, a.x, a.y, colR, "asteroid", a);
    }
  }

  for (const s of sys.stations) {
    expectedIds.add(s.id);
    if (grid.has(s.id)) {
      grid.update(s.id, s.x, s.y, s.radius);
    } else {
      grid.insert(s.id, s.x, s.y, s.radius, "station", s);
    }
  }

  for (const p of getState().wreckPieces) {
    if (p.hp <= 0) continue;
    expectedIds.add(p.id);
    if (grid.has(p.id)) {
      grid.update(p.id, p.x, p.y, p.radius);
    } else {
      grid.insert(p.id, p.x, p.y, p.radius, "wreckpiece", p);
    }
  }

  for (const id of grid.entities.keys()) {
    if (!expectedIds.has(id)) {
      grid.remove(id);
    }
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : 0;
  recordSyncTime(t1 - t0);
}
