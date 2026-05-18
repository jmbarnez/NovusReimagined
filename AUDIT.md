# Novus — Comprehensive Audit & Optimization Sweep

**Date:** 2026-05-13
**Scope:** 97 TypeScript source files (~16.7k LOC). Vite + pixi.js + vitest. Fixed-timestep 60 Hz simulation with global mutable state singleton `G`.

---

## Summary of Changes

The codebase is in good overall shape: security clean, no dead code, no commented-out blocks, well-organized event bus, consistent style, sensible architectural rules in `AGENTS.md`. The three biggest concrete problems are:

1. **Per-frame `Map` allocations** in three renderers (`drawAsteroids`, `drawEnemies`, `drawWreckPieces`). Each frame builds a fresh `Map` of the player's lock queue. Trivially hoistable.
2. **Resource leaks**: a `Worker` is created with no `terminate()` path, two `window.resize` listeners are never removed, and the worker uses bare `setInterval` with no `clearInterval`. Survives HMR reloads, causing duplicate ticks in dev.
3. **109 `any` types** across 47 files, densest in hot files (`dock.ts`, `combat.ts`, `physics/npcs.ts`). Targeted tightening recommended; full purge is a separate effort.

Five small fixes land in this sweep (Fixes 1–5 below). Larger refactors are tracked in **Manual To-Do List**.

---

## 1. Findings by Category

### Performance

| Severity | Location | Issue |
|---|---|---|
| High | [src/render/world/entities.ts:99](src/render/world/entities.ts#L99), [:202](src/render/world/entities.ts#L202) | `new Map()` per frame to build a lock lookup. ✅ **Fixed** |
| High | [src/render/world/wrecks-pickups.ts:14](src/render/world/wrecks-pickups.ts#L14) | `new Map()` per frame for the same purpose. ✅ **Fixed** |
| Medium | [src/render/world/entities.ts:285-286](src/render/world/entities.ts#L285-L286) | `ctx.measureText()` called twice per enemy per frame; results are stable per (name+level) pair. ✅ **Fixed** (cached on enemy instance) |
| Medium | [src/physics/npcs.ts:449](src/physics/npcs.ts#L449), [src/render/background.ts:34](src/render/background.ts#L34) | `Math.max(0, ...arr.map(...))` allocates a temp array + uses spread. ✅ **Fixed** (npcs); background reviewed (called once per system, not per frame — OK to leave). |
| Medium | Render pipeline | ~85 `createRadialGradient` / `createLinearGradient` calls per frame across the renderers; only `_dmgFlashCache` ([game-loop.ts:36](src/game-loop.ts#L36)) is cached. **Out of scope** — see To-Do. |

### Resource Leaks

| Severity | Location | Issue |
|---|---|---|
| High | [src/worker/ticker.worker.ts:5](src/worker/ticker.worker.ts#L5) | `setInterval` with no stored handle; never `clearInterval`. ✅ **Fixed** (responds to `{type:"stop"}`) |
| High | [src/game-loop.ts:38](src/game-loop.ts#L38) | `Worker` never `terminate()`d. ✅ **Fixed** (`stopGameLoop()`) |
| Medium | [src/canvas.ts:45](src/canvas.ts#L45) | `window.addEventListener("resize", resize)` never removed. ✅ **Fixed** (`disposeCanvas()`) |
| Medium | [src/game-loop.ts:229](src/game-loop.ts#L229) | Second `resize` listener (`resizePixi`) never removed. ✅ **Fixed** |

### Edge Cases

| Severity | Location | Issue |
|---|---|---|
| Medium | [src/utils/math.ts:37](src/utils/math.ts#L37) | `rpick<T>(f, arr: T[]): T` returns `undefined` on empty arrays — signature is a lie. ✅ **Fixed** — signature now `T \| undefined`, callers checked. |
| Low | [src/loot/generateModule.ts:52](src/loot/generateModule.ts#L52) | `affixDef.tiers[0]` fallback assumes `tiers` is non-empty. ✅ **Fixed** (skips affix if no tier). |
| Low | [src/dock.ts:142](src/dock.ts#L142) | `gates?.[0]` silently undefined when warping to a gate-less system. ✅ **Fixed** (logs warning + uses `(0,0)` fallback explicitly). |
| Low | [src/player/player-data.ts:88-152](src/player/player-data.ts#L88-L152) | `JSON.parse` cast as `Player` without shape check. **Currently safe** because the function defensively initializes missing fields and is wrapped in try/catch — left as-is. |
| Low | [src/data/settings.ts:143-169](src/data/settings.ts#L143-L169) | `loadSettings()` already pulls each field with `??` defaults inside try/catch — **already robust**, no change needed. |

### Type Safety

- 109 `any` occurrences across 47 files. Worst offenders:
  - [src/dock.ts:17](src/dock.ts#L17) — `dockAt(st: any)`
  - [src/combat.ts:25](src/combat.ts#L25) — `computeAimDeviation(target: any, turretMod: any, wProf: any)`
  - [src/ui/inventory.ts:66](src/ui/inventory.ts#L66) — `export const INV_STATE: any = {}`
- ~340 `!` non-null assertions; densest in `src/audio/procedural/*` (audio context init order) and `src/ui/settings.ts`, `src/ui/hud-overlay.ts` (DOM queries).
- Most exported functions lack explicit return-type annotations (relies on inference).
- **Out of scope for this sweep** — full type purge needs per-file design (see To-Do).

### Architecture / Rule Violations

| Location | Issue |
|---|---|
| 5 sites in `utils/game.ts`, `player-fitting.ts`, `physics/ship.ts`, `combat/damage-display.ts`, `player-data.ts` | 4-rack iteration `["turret", "high", "med", "low"] as const` duplicated. ✅ **Fixed** — extracted to `RACK_TYPES` in `constants.ts`. |
| [src/utils/game.ts:70-77](src/utils/game.ts#L70-L77) | `respawnPlayer()` directly mutates `Client.stationOpen`/`bridgeOpen`/`overviewOpen`/`showMap`/`settingsOpen`/`activeStation` — violates AGENTS.md rule "UI state should only be set from the module that owns that UI." ✅ **Fixed** — Client state resets moved into the `ui:close-overlays` subscribers in `ui/bridge.ts`, `ui/station.ts`, `ui/settings.ts`. |

### Security

- ✅ No `eval` / `new Function` / unsanitized string timers.
- ✅ All `innerHTML` (~40 sites in 19 files) is built from template literals routed through `escHtml()` at [src/utils/format.ts:11](src/utils/format.ts#L11).
- ✅ No hardcoded secrets, no auth tokens, no API keys.
- ✅ Save deserialization is wrapped in try/catch with defensive defaults.

### Documentation / Style

- [AGENTS.md:131](AGENTS.md#L131) claimed `tsconfig.json` uses `strict: false` — **actual** is `strict: true, noUncheckedIndexedAccess: false`. ✅ **Fixed** in AGENTS.md.
- Mixed-concern files still real per AGENTS.md "Known Architectural Debt": `ui/station.ts` (504 lines), `physics/npcs.ts` (541 lines), `render/world/entities.ts` (557 lines). Splits tracked as manual to-do.
- No commented-out code blocks. No magic-number sprawl (`src/constants.ts` already exports 61 named constants).

---

## 2. Before / After Refactor Examples

### Example A — `rpick()` edge-case guard

**Before** ([src/utils/math.ts:37](src/utils/math.ts#L37)):
```ts
export function rpick<T>(f: () => number, arr: T[]): T {
  return arr[Math.floor(f() * arr.length)];
}
```

**After**:
```ts
export function rpick<T>(f: () => number, arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(f() * arr.length)];
}
```

All three callsites (`generateModule.ts`, `world-gen.ts`, `spawn.ts`) already guard against the empty case or check the result; the new signature makes that contract explicit.

### Example B — Worker / listener lifecycle

**Before** ([src/worker/ticker.worker.ts:5](src/worker/ticker.worker.ts#L5)):
```ts
const INTERVAL_MS = 1000 / 60;
setInterval(() => self.postMessage(1), INTERVAL_MS);
```

**After**:
```ts
const INTERVAL_MS = 1000 / 60;
const handle = setInterval(() => self.postMessage(1), INTERVAL_MS);
self.addEventListener("message", (e) => {
  if ((e.data as any)?.type === "stop") clearInterval(handle);
});
```

Paired with a new `stopGameLoop()` in [game-loop.ts](src/game-loop.ts) that posts the stop message and calls `worker.terminate()`, plus a `disposeCanvas()` in [canvas.ts](src/canvas.ts) that removes the resize listener.

### Example C — Hoisted lock map (per-frame `Map` removed)

**Before** ([src/render/world/entities.ts:99-103](src/render/world/entities.ts#L99-L103)):
```ts
export function drawAsteroids(alpha: number, sys: any, now: number) {
  if (!sys?._liveAsteroids) return;
  const mineR = getStats().mineRange;
  const lockMap = new Map();
  const primaryId = G.P.targetLock?.id;
  if (Array.isArray(G.P.lockQueue)) {
    for (const slot of G.P.lockQueue) lockMap.set(slot.id, slot);
  }
  ...
}
```

**After** (module scope):
```ts
const _asteroidLockMap = new Map<string, any>();

export function drawAsteroids(alpha: number, sys: any, now: number) {
  if (!sys?._liveAsteroids) return;
  const mineR = getStats().mineRange;
  _asteroidLockMap.clear();
  const primaryId = G.P.targetLock?.id;
  if (Array.isArray(G.P.lockQueue)) {
    for (const slot of G.P.lockQueue) _asteroidLockMap.set(slot.id, slot);
  }
  ...
}
```

Same shape applied to `drawEnemies` and `drawWreckPieces`.

### Example D — `RACK_TYPES` extraction

**Before** (repeated 5×):
```ts
for (const rack of ["turret", "high", "med", "low"] as const) { ... }
```

**After** (in `src/constants.ts`):
```ts
export const RACK_TYPES = ["turret", "high", "med", "low"] as const;
export type RackId = (typeof RACK_TYPES)[number];
```

Imported and used at each site. The `["high", "med", "low"]` form in [dock.ts:54](src/dock.ts#L54) is **intentionally** different (undock should not disable turret slots, which are toggled via `turretPower` instead of `slotActive`) — left in place with a comment.

### Example E — `measureText` cache on enemy instance

**Before** ([src/render/world/entities.ts:284-286](src/render/world/entities.ts#L284-L286)):
```ts
ctx.font = "9px monospace";
const nameW = ctx.measureText(e.name).width;
const lvlW  = ctx.measureText(lvlText).width;
```

**After**:
```ts
ctx.font = "9px monospace";
const labelKey = `${e.name}|${lvl}`;
if (e._labelKey !== labelKey) {
  e._labelKey = labelKey;
  e._nameW = ctx.measureText(e.name).width;
  e._lvlW  = ctx.measureText(lvlText).width;
}
const nameW = e._nameW, lvlW = e._lvlW;
```

`measureText` is now called once per enemy (per name/level change) instead of every frame.

### Example F — `respawnPlayer` UI rule compliance

**Before** ([src/utils/game.ts:70-77](src/utils/game.ts#L70-L77)):
```ts
export function respawnPlayer() {
  Client.stationOpen = false;
  Client.activeStation = null;
  Client.bridgeOpen = false;
  Client.overviewOpen = false;
  Client.showMap = false;
  Client.settingsOpen = false;
  emit("ui:close-overlays");
  ...
}
```

**After** (delegation to owning modules via existing event):
```ts
export function respawnPlayer() {
  Client.showMap = false;   // map is not owned by any UI module; keep here
  emit("ui:close-overlays");
  ...
}
```

Subscribers in `ui/station.ts`, `ui/bridge.ts`, `ui/settings.ts` now reset their own `Client.*` fields.

---

## 3. Manual To-Do List (Out of Scope for This Sweep)

These items require human judgment, dedicated PRs, or non-trivial design work:

- [ ] **Gradient pool / cache** across all renderers (~85 gradients/frame). Touches every renderer; needs a per-key cache keyed on (color, w, h, viewport-relative coords) with eviction. Visual-regression risk; deserves its own PR.
- [ ] **`any` purge** in `dock.ts`, `combat.ts`, `physics/npcs.ts`, `ui/inventory.ts`. Needs proper interface design for `Station`, `Enemy`, `WeaponProfile`, `TurretMod`.
- [ ] **`!` non-null assertion audit** in `src/audio/procedural/*` — restructure init order so the audio context is constructed before any module-scope code that asserts non-null.
- [ ] **File splits** per still-open AGENTS.md debt items: `ui/station.ts`, `physics/npcs.ts`, `render/world/entities.ts`. Each is internally coherent but mixes 3+ concerns.
- [ ] **Enable `noUncheckedIndexedAccess`** in `tsconfig.json` — will surface many new errors in array/record accesses. Useful but a sizable cleanup.
- [ ] **`G` encapsulation** — long-standing item. Convert to a passed-in context object so a headless server could re-use the simulation.
- [ ] **Test coverage** — current tests only cover math/entities/player-stats. Expand to physics, targeting, combat damage flow.
- [ ] **innerHTML compare-before-write** in [src/ui/hud/overview.ts:27](src/ui/hud/overview.ts#L27) — partial today, extend to all assignments.
- [ ] **`respawnPlayer()` DOM coupling** — still touches DOM directly for some overlays per AGENTS.md. With this sweep's event-driven refactor in place, finish the migration.
- [ ] **CSS file splits**: `station.css` (1429 lines), `hud.css` (967 lines). Split by component.

---

## 4. Verification

After this sweep, run:

```bash
npm run typecheck   # must pass; rpick signature change is the most likely fail
npm run test:run    # existing tests + new rpick([]) test
npm run build       # must succeed
```

Manual smoke tests:

1. Load game, undock, fly 30 s → no console errors.
2. Take damage → die → respawn → confirm station/bridge/settings overlays all close.
3. Open station, swap modules across all four racks → confirm turret rack works (verifies dock.ts undock behavior).
4. Corrupt `localStorage["ss2-sim-v1"]` to invalid JSON, reload → game starts fresh, no crash.
5. Open DevTools → Performance, record 10 s → confirm fewer minor GC events vs. baseline (the hoisted `Map`s and cached `measureText` should be visible as flatter GC sawtooth).
