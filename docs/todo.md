# Developer To-Do List

## Known Architectural Debt

- [ ] `G` is a global mutable singleton — writes are now fully encapsulated via `PlayerAccess`/`WorldAccess`/`MiningAccess`/`SalvagerAccess`, but reads remain direct
- [ ] Test coverage is minimal (math, entities, player-stats only)
- [ ] `tsconfig.json` uses `strict: true` but `noUncheckedIndexedAccess: false`. Enabling the latter is a follow-up cleanup
- [ ] `audio/procedural.ts` uses `_master!` non-null assertions — init order should be restructured
- [ ] Economy commands currently rely on snapshot-state confirmation only (no explicit per-command ACK/ERR reason channel to UI)

## Resolved Debt Items

- ~~109 'any' types across 47 files~~ — Fully eliminated all `any` types from the codebase, replacing them with strict typings (`System`, `Enemy`, `Asteroid`, `WreckPiece`, `SalvagePickup`, etc.).
- ~~`ui/hud-overlay.ts` (~819 lines)~~ — Refactored to 286 lines with 8 sub-modules totaling ~920 lines
- ~~`render/world.ts` (~797 lines) and `render/world/` folder~~ — Transitioned all dynamic space objects (Stars, planets, border boundaries, bullets, mining lasers, tractor spring vectors, wrecks, salvage containers, floating damage cards, shield waves, hull sparks, and brackets) to high-performance PixiJS GPU rendering, and consolidated the four remaining legacy screenspace/station overlay functions into `src/render/world-overlays.ts`, fully deleting the `render/world/` sub-directory.
- ~~`src/render/world/entities.ts` (~557 lines)~~ — Eliminated the massive multi-concern file and modularized drawing logic across specialized PixiJS managers.
- ~~Per-frame CPU radial/linear gradients~~ — Resolved by procedurally drawing stars, planets, and asteroids once on startup and baking them directly into high-res GPU textures.
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
- ~~Direct `G.*` world-level mutations across codebase~~ — World fields via `WorldAccess`; per-player warp/beams on `Player` via `PlayerAccess` / beam accessors; `G.P` init via registry in `state-access.ts`
- ~~Direct `G.P.*` player state mutations across codebase~~ — All `G.P.*` field writes and array mutations (push/splice/fill/unshift/pop) across 18 files now go through `PlayerAccess` (42 methods) in `state-access.ts`; zero direct `G.P.*` writes remain outside of `state-access.ts`
- ~~Station economy and contract accept/turn-in flow client-authoritative~~ — migrated to `queueFrameAction` command handlers with server validation + snapshot sync.
- ~~Hub processing/smelting/collect flow client-authoritative~~ — moved to server command handlers and server tick queue processing.
- ~~Inventory fit/swap/unfit/jettison local mutate path~~ — now command-queued and reconciled from snapshots.
- ~~`src/ui/wreck.ts` (~470 lines) — three distinct UI concerns~~ — Wreck game logic moved to `src/wreck.ts` (439 lines, pure simulation); UI concerns removed from the file entirely
- ~~`src/physics/npcs.ts` (~541 lines) — AI, physics, combat interleaved~~ — Split into `src/physics/npcs/` (5 files: `index.ts`, `movement.ts`, `combat.ts`, `asteroids.ts`, `respawn.ts`) + `src/physics/npc-ai.ts` for AI behavior
- ~~Large CSS: `station.css` (1429 lines), `hud.css` (967 lines)~~ — `station.css` split into 5 component files (`station-base/contracts/hangar/industry/market.css`); `hud.css` split into 16+ component files + `hud-misc/` subdirectory in `src/ui/styles/`
- ~~`src/state-access.ts` (~897 lines) — monolithic state accessors file~~ — Split into 7 domain-specific modules under `src/state/access/` and replaced with a barrel re-export file
- ~~`src/ui/hud/ship-panel.ts` (~677 lines) — monolithic HUD ship stats/turrets panel file~~ — Split into 6 domain-specific modules under `src/ui/hud/ship-panel/` and replaced with a barrel re-export file
- ~~`src/ui/settings.ts` (~535 lines) — monolithic settings panel file~~ — Split into 5 domain-specific modules under `src/ui/settings/` and replaced with a barrel re-export file
