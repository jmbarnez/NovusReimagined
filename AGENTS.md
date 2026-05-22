# Star Sonata — Developer Guide

## Build Commands

```bash
npm run dev        # Start dev server with hot reload
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm run check      # Build to catch type/syntax errors (alias: vite build)
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (watch)
npm run test:run   # Vitest (single run)
npm run lint       # Linter (currently a no-op placeholder)
```

## Architecture Overview

### State Management

All mutable game state lives in `src/state.ts` as the global singleton `G`. Modules
read from `G` directly but **must not write to `G.*` fields directly**. All writes go
through the domain-specific accessors in `src/state-access.ts`:
- `PlayerAccess` — player vitals, fitting, resources, skills
- `WorldAccess` — warp state, galaxy, background stars, spatial grid, player init
- `MiningAccess` — mining laser state
- `SalvagerAccess` — salvager beam state

Exception: `G._statsCache` is internal to `player-stats.ts`.

When adding new state, prefer adding fields to `G.P` (player state) or to `G` itself,
and add a corresponding accessor method. Keep simulation entities (`bullets`, `beams`,
`particles`) separate from UI/client state (held in `Client` from the same module:
`stationOpen`, `bridgeOpen`, etc.).

**Key rules:**
- All `G.*` and `G.P.*` field writes must go through accessors in `src/state-access.ts`.
- All `G.P.*` array mutations (push, splice, unshift, pop, fill) must also go through
  `PlayerAccess` methods (e.g. `addModuleCargo`, `removeModuleCargo`, `spliceLockQueue`).
- Direct `G.P.*` reads are allowed everywhere for performance.
- Do not directly assign empty arrays to simulation entity fields (e.g. `G.bullets = []`).
  Use `clearSimulationEntities()` from `src/utils/entities.ts`.
- Do not push directly to simulation entity arrays (`G.bullets.push(...)`, etc.).
  Use the `addBullet()`, `addEnemyBullet()`, `addBeam()`, `addParticle()`, `addFloatText()`,
  `addWreck()`, `addCreditPickup()` helpers from `src/utils/entities.ts`.
- Do not mix game-logic mutations with DOM manipulation in the same function.
- UI state (`Client.stationOpen`, `Client.settingsOpen`, etc.) should only be set from the
  module that owns that UI, not from physics or combat code.

### Event Bus

`src/events.ts` provides a typed event bus (`on` / `off` / `emit` / `offAll`).
Use events for cross-module communication instead of direct state mutations.

**Active events:**

| Event | Emitted by | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `simulation:clear` | `dock.ts:warpTo()`, `utils/game.ts:respawnPlayer()` | — | — |
| `module:toggle` | `player/player-fitting.ts` | — | `{ rack, idx, active, moduleId }` |
| `player:respawn` | `utils/game.ts:respawnPlayer()` | `ui/wreck.ts:closeWreckCargo()` | `{ homeIdx, penalty }` |

### Module Naming Conventions

```
src/
  combat/          Combat subsystem: game logic (damage calc, hit chance) + VFX helpers
  data/            Pure data definitions (ships, modules, enemies, recipes, etc.)
  events.ts        Typed event bus for cross-module communication
  physics/         Fixed-timestep simulation (ship, npcs, projectiles, collision)
  player/          Player state: data, stats, fitting, skills
  render/          Canvas 2D rendering (world, HUD, background, perf overlay)
  types/           Shared structural interfaces (entities, world, lock state)
  ui/              DOM-based overlays (station, bridge, inventory, settings)
  utils/           Pure utilities (math, spatial grid, FX helpers, camera, entities)
  audio/           Procedural Web Audio SFX
  worker/          Off-main-thread workers (e.g. ticker)
```

### State Access Rules

| State type | Read by | Written by | Notes |
|-----------|---------|-----------|-------|
| `G.bullets`, `G.enemyBullets`, `G.beams`, `G.particles` | render | combat.ts, npcs.ts | Lifecycle via `src/utils/entities.ts` |
| `G.wrecks`, `G.creditPickups`, `G.floatTexts`, `G.impactDecals` | render, wreck.ts | wreck.ts, fx.ts, effects.ts | Lifecycle via `src/utils/entities.ts` |
| `G.warpCooldown`, `G.warpTargetIdx` | dock.ts, game-loop.ts | dock.ts, game.ts | Via `WorldAccess.setWarpCooldown()` / `setWarpTargetIdx()` |
| `G.miningLaser.*` | render | physics/npcs.ts, utils/game.ts | Via `MiningAccess.update({...})` |
| `G.salvager.*` | render, wreck.ts | wreck.ts | Via `SalvagerAccess.update({...})` |
| `G.GALAXY`, `G.STARS*`, `G.DUST` | render, dock.ts, npcs.ts | main.ts, background.ts | Via `WorldAccess.setGalaxy()` / `setStars()` / etc. |
| `G.P` (init) | everywhere | main.ts | Via `WorldAccess.initPlayer()` |
| `G.spatialGrid` | physics, combat | main.ts | Via `WorldAccess.setSpatialGrid()` |
| `G.P.fitting`, `G.P.moduleCargo` | station.ts, player-stats | station.ts | Fitting changes must call `validateFitting()` + `invalidate()` |
| `G.P.slotActive` | physics/ship.ts, hud-overlay | hud-overlay.ts | UI-driven only |
| `G.P.shield/hp/structure` | hud-overlay, station | damage-display.ts, station repair | Damage flows through `damagePlayer()` in `combat/damage-display.ts` |
| `G.P.craftQueue` | industry.ts, game-loop.ts | station.ts | Persists across saves; uses `Date.now()` wall-clock timestamps |
| `Client.camx/Client.camy` | render | `utils/camera.ts` | Camera update called from `physics/ship.ts` tick |

### Adding New Content

**New ship type:**
1. Add entry to `src/data/ships.ts`
2. Add render config to the ship's `render` key: `path` (array of [x,y] pairs), `fill`, `stroke`, `nozzleOffsets`, `cockpit` (`{ cx, cy, rx, ry }`)
3. `shipPath()` in `src/render/world.ts` reads from `SHIPS[id].render.path` — no switch update needed
4. Cockpit ellipse reads from `SHIPS[id].render.cockpit` — no switch update needed

**New enemy type:**
1. Add entry to `src/data/enemies.ts` (`ENEMY_DEFS`)
2. Add `render` config: `path` (array of [x,y] pairs), `fill`, `stroke`; use `pathType: "polygon8"` for octagon shapes
3. `enemyPath()` in `src/render/world.ts` reads from `ENEMY_DEFS[type].render` — no switch update needed
4. Adjust spawn pool in `src/world-gen.ts` if needed

**New module:**
1. Add entry to `src/data/modules.ts` (`MODULES` catalog)
2. Set capability flags: `mining: true` for mining turrets, `isActive: true` for active modules, `isSalvager: true` for salvagers, `weaponDelivery` for weapon types
3. Add weapon profile to `src/data/weaponProfiles.ts` if it has a `weaponDelivery` type
4. Add effects in `src/player/player-stats.ts` (`computeStats()`) and/or `src/physics/ship.ts`
5. Station market: no code change needed (all modules auto-appear)

**Module effects registry:** `MODULE_FLAGS` in `src/data/modules.ts` provides typed predicate functions
(`isWeapon`, `isMiningTurret`, `isBeam`, `isProjectile`, `isMissile`, `isActive`, `isSalvager`).
Use these instead of scattered `if (m.weaponDelivery)` / `if (isMiningTurretMod(m))` checks.

**New skill:**
1. Add ID to `src/data/skills.ts` (`SKILL_IDS`)
2. Add definition to `SKILL_DEF`
3. Apply effects in `src/player/player-stats.ts:computeStats()`

### Key Patterns

**Fixed timestep:** Game physics run at `TICK_HZ = 60` Hz (`TICK_DT = 1/60`). The game loop
in `src/game-loop.ts` uses a fixed accumulator. Rendering runs at display refresh rate.

**Spatial grid:** `SpatialGrid` in `src/utils/spatial.ts` is rebuilt every tick via
`rebuildSpatialGrid()`. It holds enemies, asteroids, and player for O(1) collision queries.

**Stats cache:** `getStats()` in `player-stats.ts` returns a cached stats object. Any module
that changes fitting, skills, or ship must call `invalidate()` to bust the cache.

**Mining:** Shared via `src/utils/mining.ts:harvestAsteroid()`. Called from both
`combat.ts:miningTurretFire()` (turret auto-fire) and `physics/npcs.ts:updateMining()` (manual laser).

**Entity lifecycle:** All simulation entity creation, clearing, and removal goes through
`src/utils/entities.ts`. Use `addBullet()`, `addBeam()`, `addFloatText()`, etc. instead of
direct `G.bullets.push()`. Use `clearSimulationEntities()` instead of `G.bullets = []`.

### Known Architectural Debt

- [ ] `G` is a global mutable singleton — writes are now fully encapsulated via `PlayerAccess`/`WorldAccess`/`MiningAccess`/`SalvagerAccess`, but reads remain direct
- [ ] Test coverage is minimal (math, entities, player-stats only)
- [ ] `tsconfig.json` uses `strict: true` but `noUncheckedIndexedAccess: false`. Enabling the latter is a follow-up cleanup
- [ ] `audio/procedural.ts` uses `_master!` non-null assertions — init order should be restructured
- [ ] `src/ui/station.ts` (~504 lines) mixes DOM construction, event binding, and game-state mutations
- [ ] `src/ui/wreck.ts` (~470 lines) — three distinct UI concerns (wreck list, cargo, salvaging) in one file
- [ ] `src/physics/npcs.ts` (~541 lines) — AI state machines, physics integration, and combat firing are interleaved
- [ ] `src/render/world/entities.ts` (~557 lines) — four independent renderers (asteroids, enemies, player, ambient life) in one file
- [ ] ~85 per-frame `createRadialGradient`/`createLinearGradient` calls across renderers — only the damage-flash gradient is currently cached
- [ ] Large CSS files: `station.css` (1429 lines), `hud.css` (967 lines) — consider splitting by component

### Resolved Debt Items

- ~~109 'any' types across 47 files~~ — Fully eliminated all `any` types from the codebase, replacing them with strict typings (`System`, `Enemy`, `Asteroid`, `WreckPiece`, `SalvagePickup`, etc.).
- ~~`ui/hud-overlay.ts` (~819 lines)~~ — Refactored to 286 lines with 8 sub-modules totaling ~920 lines
- ~~`render/world.ts` (~797 lines)~~ — Split into barrel re-exports + sub-modules in `render/world/*.ts`
- ~~Entity removal not centralized~~ — All simulation arrays now use helpers from `src/utils/entities.ts`; `impactDecals` added to lifecycle system
- ~~`isMiningTurretMod()` legacy wrapper~~ — Fully migrated to `MODULE_FLAGS.isMiningTurret(m)`; zero references remain
- ~~Direct `G.array = []` assignments~~ — Properly uses `clearSimulationEntities()` with `.length = 0`
- ~~`drawTargetArrow` per-frame `edges[]` alloc~~ — Pre-allocated `Float64Array(4)` reused across frames in `render/hud.ts`
- ~~`respawnPlayer()` directly mutating UI-owned `Client` state~~ — Now delegates via `ui:close-overlays` event; each owning UI module resets its own `Client.*` flag
- ~~Per-frame `new Map()` in `drawAsteroids` / `drawEnemies` / `drawWreckPieces`~~ — Hoisted to module-scoped `Map`s and cleared per call
- ~~Per-frame `ctx.measureText()` for enemy labels~~ — Cached on the enemy instance, keyed on `(name, level)`
- ~~`rpick()` lying about non-undefined return on empty arrays~~ — Signature now `T | undefined`; callers updated
- ~~Resource leaks: ticker worker `setInterval` + two `window.resize` listeners never cleaned up~~ — `stopGameLoop()` posts stop message, terminates worker, removes listeners; auto-fires on Vite HMR dispose
- ~~Duplicated `["turret","high","med","low"] as const` arrays at 5+ sites~~ — Single source of truth in `constants.ts` as `RACK_TYPES`
- ~~Direct `G.*` world-level mutations across codebase~~ — All `G.warpCooldown`, `G.warpTargetIdx`, `G.miningLaser.*`, `G.salvager.*`, `G.GALAXY`, `G.STARS*`, `G.DUST`, `G.spatialGrid`, and `G.P` init writes now go through `WorldAccess`, `MiningAccess`, or `SalvagerAccess` in `state-access.ts`
- ~~Direct `G.P.*` player state mutations across codebase~~ — All `G.P.*` field writes and array mutations (push/splice/fill/unshift/pop) across 18 files now go through `PlayerAccess` (42 methods) in `state-access.ts`; zero direct `G.P.*` writes remain outside of `state-access.ts`

## TypeScript & Type Safety Guidelines

To maintain type integrity and avoid subtle runtime bugs, adhere to the following rules:

### 1. Strict Prohibition of the `any` Keyword
- **No explicit `any` declarations**: Avoid declaring parameters, variables, fields, or function return types as `any`.
- **No loose `as any` typecasts**: Do not use `as any` to bypass compile-time checks. If a type mismatch occurs, refactor the interfaces or declare a proper union/intersection type instead.

### 2. Alternatives to `any`
- **Use `unknown` for unsafe boundaries**: When parsing input, loading external save state, or interacting with generic structures where the type is truly undetermined, use `unknown`.
- **Narrow types with guards**: Use type predicates (`x is T`), `typeof`, or `instanceof` checks to safely narrow `unknown` values:
  ```typescript
  function isString(val: unknown): val is string {
    return typeof val === "string";
  }
  ```
- **Type indexing strictly**: Use `Record<string, unknown>` rather than `any` for arbitrary dictionary objects.

### 3. Entity Domain Typings
Always import and use the dedicated interfaces from `src/types/world.ts` or `src/state.ts` when referring to core space objects:
- **`System`**: A galaxy sector containing planets, stations, enemies, and asteroids.
- **`Enemy`**: An NPC actor (hostile, friendly, or neutral).
- **`Asteroid`**: A mineable mineral deposit.
- **`Station`**: A dockable orbital facility.
- **`WreckPiece`**: Debris created when a ship is destroyed.
- **`SalvagePickup`**: Proximity-collected cargo or credits.
- **`ModuleDef`**: Immutable configuration for a ship module catalog entry.
- **`ModuleInstance`**: An instantiated module instance in a container or slot with durability and affixes.

### 4. Verification Checklists
- Before concluding a code change, always run:
  ```bash
  npm run typecheck
  npm run test:run
  ```
- Make sure both the compiler type checker and the unit test suite complete with zero errors.
