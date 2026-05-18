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
read from and write to `G` directly. When adding new state, prefer adding fields to
`G.P` (player state) or to `G` itself. Keep simulation entities (`bullets`, `beams`,
`particles`) separate from UI/client state (held in `Client` from the same module:
`stationOpen`, `bridgeOpen`, etc.).

**Key rules:**
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

- [ ] `G` is a global mutable singleton — no encapsulation
- [ ] Test coverage is minimal (math, entities, player-stats only)
- [ ] `tsconfig.json` uses `strict: true` but `noUncheckedIndexedAccess: false`. Enabling the latter is a follow-up cleanup
- [ ] `audio/procedural.ts` uses `_master!` non-null assertions — init order should be restructured
- [ ] `src/ui/station.ts` (~504 lines) mixes DOM construction, event binding, and game-state mutations
- [ ] `src/ui/wreck.ts` (~470 lines) — three distinct UI concerns (wreck list, cargo, salvaging) in one file
- [ ] `src/physics/npcs.ts` (~541 lines) — AI state machines, physics integration, and combat firing are interleaved
- [ ] `src/render/world/entities.ts` (~557 lines) — four independent renderers (asteroids, enemies, player, ambient life) in one file
- [ ] ~85 per-frame `createRadialGradient`/`createLinearGradient` calls across renderers — only the damage-flash gradient is currently cached
- [ ] 109 `any` types across 47 files; densest in `dock.ts`, `combat.ts`, `physics/npcs.ts`, `ui/inventory.ts`
- [ ] Large CSS files: `station.css` (1429 lines), `hud.css` (967 lines) — consider splitting by component

### Resolved Debt Items

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
