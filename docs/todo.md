# Developer To-Do List

## Known Architectural Debt

- [ ] `G` is a global mutable singleton — writes are now fully encapsulated via `PlayerAccess`/`WorldAccess`/`MiningAccess`/`SalvagerAccess`; `getState()` no longer exposes mutation paths (`pendingEffects`, `_statsCache`, entity arrays all migrated to accessors or direct `_G` in canonical lifecycle modules)
- [ ] `tsconfig.json` uses `strict: true` but `noUncheckedIndexedAccess: false`. Enabling the latter is a follow-up cleanup
- [ ] `audio/procedural.ts` uses `_master!` non-null assertions — init order should be restructured
- [ ] Economy commands currently rely on snapshot-state confirmation only (no explicit per-command ACK/ERR reason channel to UI)
- [ ] Rendering pipeline lifecycle is scattered across Pixi modules — centralize renderer/system ownership, reset/destroy hooks, and layer validity checks before deeper GPU/frame-budget optimization

## Resolved Debt Items

- ~~Architecture fitness checks documented but not wired~~ — `npm run lint` now runs `scripts/check-gp-boundaries.ts` and enforces server authority, UI command boundaries, entity lifecycle mutation, state write boundaries, and removed screen-canvas regressions.
- ~~Test coverage is minimal (math, entities, player-stats only)~~ — The suite now covers 80+ focused test files across sim, server, Pixi, UI, tutorial, net, and state behavior.
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
- ~~`src/ui/inventory/overlays.ts` (~531 lines) — monolithic inventory overlays file~~ — Split into `src/ui/inventory/overlays/` directory (8 files: `types.ts`, `elements.ts`, `toast.ts`, `hover.ts`, `position.ts`, `info-html.ts`, `ctx-html.ts`, `update.ts`) with barrel re-exports
- ~~`src/ui/hud/targeting.ts` (~541 lines) — monolithic HUD lock rail / targeting panel file~~ — Split into `src/ui/hud/targeting/` directory (5 files: `types.ts`, `icon.ts`, `create.ts`, `update-card.ts`, `rail.ts`) with barrel re-exports
- ~~`src/tutorial.ts` (~337 lines) — monolithic tutorial runner file~~ — Split into `src/tutorial/` directory (5 files: `index.ts`, `runner.ts`, `shared.ts`, `events.ts`, `hangar-tour.ts`) with barrel re-exports
- ~~`src/player/player-data.ts` (~497 lines) — monolithic player data + migrations + init~~ — Split into `src/player/player-factory.ts` (117 lines) and `src/player/migrations/` (3 files, 124 lines total); `player-data.ts` reduced to 276 lines
- ~~`src/net/client-session.ts` (~622 lines) — monolithic session handler~~ — Split into 5 focused handlers: `game-fx-handler.ts` (88 lines), `snapshot-handler.ts` (88 lines), `remote-players.ts` (26 lines), `character-sync.ts` (23 lines), `chat-handler.ts` (48 lines); `client-session.ts` reduced to 319 lines
- ~~`src/salvager.ts` (~112 lines) — root-level player concern~~ — Moved to `src/player/salvager.ts`; all importers updated (`src/physics.ts`, `src/render/combat/utility.ts`)
- ~~`src/tractor.ts` (~151 lines) — root-level player concern~~ — Moved to `src/player/tractor.ts`; all importers updated (`src/physics.ts`, `src/render/combat/utility.ts`)
- ~~`src/utils/entities.ts` (~542 lines) — monolithic entity lifecycle file~~ — Split into `src/utils/entities/` directory (8 files: `id.ts`, `bullets.ts`, `beams.ts`, `particles.ts`, `float-texts.ts`, `shockwaves.ts`, `trails.ts`, `impact-decals.ts`, `wreck-salvage.ts`, `lifecycle.ts`) with `entities.ts` reduced to a barrel re-export; dead `removeVisualState` import dropped
- ~~`src/state/access/player/economy.ts` (~373 lines) — monolithic economy accessors file~~ — Split into `src/state/access/player/economy/` directory (5 files: `resources.ts`, `cargo.ts`, `contracts.ts`, `crafting.ts`, `refinery-storage.ts`) with `economy.ts` reduced to a composed barrel; `this`-based cross-references refactored to direct function calls for spread-safety
- ~~`src/sim/commands/execute.ts` (~332 lines) — monolithic command dispatcher~~ — Split into `src/sim/commands/handlers/` directory (7 files: `combat.ts`, `scanning.ts`, `industry.ts`, `sites.ts`, `docking.ts`, `warp.ts`, `tutorial.ts`) with `execute.ts` reduced to a thin type-narrowing dispatcher
- ~~`src/sim/input.ts` (~350 lines) — monolithic input sanitizer file~~ — Split into `src/sim/input/` directory (8 files: `sanitize-helpers.ts`, `sanitizers/combat.ts`, `sanitizers/scanning.ts`, `sanitizers/industry.ts`, `sanitizers/sites.ts`, `sanitizers/docking.ts`, `sanitizers/warp.ts`, `sanitizers/tutorial.ts`) with `input.ts` reduced to frame-level logic + a type-narrowing sanitizer dispatcher
- ~~`src/ui/station/industry-model.ts` (~474 lines) — dead duplicate~~ — Fully migrated to `src/ui/station/industry/model/` submodules; file deleted with zero remaining importers
