import { G } from "../state.js";
import { curSys } from "./game.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";

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
}

export function rebuildSpatialGrid() {
  const grid = G.spatialGrid;
  if (!grid) return;
  grid.clear();
  const sys = curSys();
  if (!sys) return;

  if (!sys._liveEnemies) sys._liveEnemies = [];
  if (!sys._liveAsteroids) sys._liveAsteroids = [];
  let le = 0, la = 0;
  for (const e of sys.enemies) if (e.alive) sys._liveEnemies[le++] = e;
  sys._liveEnemies.length = le;
  for (const a of sys.asteroids) if (!a.depleted && a.hp > 0) sys._liveAsteroids[la++] = a;
  sys._liveAsteroids.length = la;

  const playerColRadius = SHIPS[G.P.shipId]?.colRadius ?? 20;
  grid.insert("__player", G.P.x, G.P.y, playerColRadius, "player", G.P);

  for (const e of sys._liveEnemies) {
    const colRadius = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
    grid.insert(e.id, e.x, e.y, colRadius, "enemy", e);
  }

  for (const a of sys._liveAsteroids) {
    grid.insert(a.id, a.x, a.y, a.radius, "asteroid", a);
  }

  for (const s of sys.stations) {
    grid.insert(s.id, s.x, s.y, s.radius, "station", s);
  }

  for (const p of G.wreckPieces) {
    if (p.hp > 0) grid.insert(p.id, p.x, p.y, p.radius, "wreckpiece", p);
  }
}
