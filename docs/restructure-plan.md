# Restructure Plan: Divide for Easier Writes & Maintenance

## Goal
Shrink files to <400 lines (ideally <250) and group them into narrow, discoverable directories with barrel `index.ts` files. This makes code easier to locate, review, and modify without merge conflicts.

---

## Guiding Principles

1. **Barrel files** — every subdirectory gets an `index.ts` that re-exports its public API. Consumers import from the directory, not deep files.
2. **One concern per file** — if a file exports >5 public symbols or mixes data/logic/render, split it.
3. **Preserve existing working patterns** — `state/access/`, `ui/inventory/`, and `ui/settings/` already do this well. We extend the same model.
4. **No logic changes** — this is pure code motion and re-export wiring. Behaviour stays identical.

---

## Phase 1 — Data & UI (safest, highest value)

### 1.1 `src/data/strings.ts` (102 KB → ~10 files) ✅ COMPLETE
Current: one 102 KB dictionary.

**Status:** Directory created, file split, barrel `index.ts` wired, all consumers updated. Original monolithic file removed.

```
src/data/strings/
  common.ts          // common.*
  settings.ts        // settings.*
  hud.ts             // hud.*
  station.ts         // station.*, hangar.*, market.*, contracts.*
  industry.ts        // industry.*, refinery.*, fabrication.*
  tutorial.ts        // tutorial.*
  combat.ts          // combat.*, targeting.*
  inventory.ts       // inventory.*, cargo.*
  bridge.ts          // bridge.*, comms.*
  pilot-terminal.ts  // pilotTerminal.*, connecting.*
  index.ts           // merges all into STRINGS record
```

`index.ts` builds the final `STRINGS` object so existing `import { STRINGS } from "../data/strings.js"` keeps working (or we can point it at `../data/strings/index.js`).

### 1.2 `src/ui/station/industry-renderers.ts` (59 KB → 8 files) ✅ COMPLETE
Current: 11 exported render functions, many >200 lines.

**Status:** Directory `src/ui/station/industry-renderers/` created with 15+ module files plus barrel `index.ts`. All consumers updated. Original monolithic file removed.

```
src/ui/station/industry/renderers/
  overview.ts           // renderOverview
  stage-tabs.ts         // renderStageTabs
  manifest-band.ts      // renderManifestBand
  process.ts            // renderProcessStage
  separate.ts           // renderSeparateStage
  alloy.ts              // renderAlloyStage
  fabrication.ts        // renderFabricationOverview
  assembly.ts           // renderAssemblyStage
  bottom-bar.ts         // renderBottomBar
  rails.ts              // renderRightRail, renderFabricationRail
  index.ts              // re-exports
```

### 1.3 `src/ui/station/industry-model.ts` (18 KB → 5 files) ✅ COMPLETE

```
src/ui/station/industry/model/
  state.ts              // stage meta, currentStage, selectedHeatMode, selectedProcessQty
  formatting.ts         // formatMass, formatTime, formatVolume, fmtDuration
  holdings.ts           // refineryHoldingsSummary, refineryStorageUnits, refineryZoneSummaries
  recipes.ts            // canAffordRecipe, fabricationReadyMaterials, filteredAssemblyRecipes
  composition.ts        // renderCompositionBars, renderCompositionRibbon, compositionAccentVars
  index.ts
```

**Status:** Directory created, file split, barrel `index.ts` wired, all 16 consumers updated. Original monolithic file removed.

### 1.4 `src/ui/station/industry.ts` (11 KB stays, but imports change)
Update its import to pull from `./industry/renderers/index.js` and `./industry/model/index.js`.

---

## Phase 2 — Root-level domain extraction (biggest structural win)

Move loose root files into domain directories with `index.ts` barrels.

### 2.1 `src/refinery/` (from `refining.ts` + `hub.ts`) ✅ COMPLETE

```
src/refinery/
  families.ts           // alloy families, heat constants
  composition.ts        // composition, volume, mass estimation
  assessment.ts         // alloy assessment & discovery
  storage.ts            // BulkMaterialStack helpers, storage utils
  processing.ts         // processMixedSource, separateMaterial, alloyMaterial
  hub-core.ts           // getHub, updateHub
  hub-state.ts          // hub state helpers
  hub-jobs.ts           // hub job completion handlers
  hub-cargo.ts          // hub cargo actions
  hub-output.ts         // hub output & queue
  hub-queries.ts        // hub queries & formatting
  index.ts
```

**Status:** Full domain directory created with 11 module files plus barrel `index.ts`. All consumers updated. Original monolithic `refining.ts` and `hub.ts` removed.

### 2.2 `src/wreck/` (from `wreck.ts`) ✅ COMPLETE

```
src/wreck/
  spawn.ts              // spawnWreck, buildPieceShapes
  pieces.ts             // WreckPiece update/despawn
  salvage.ts            // SalvagePickup logic, rollWreckSalvage
  collection.ts         // player proximity pickup, tractor interaction
  index.ts
```

**Status:** Directory created, file split, barrel wired, consumers updated. Original `wreck.ts` removed.

### 2.3 `src/scanning/` (from `scanning.ts`) ✅ COMPLETE

```
src/scanning/
  core.ts               // scan pulse, detection progress, strength labels
  geometry.ts           // angle helpers (normalizeAngleDeg, angularDistanceDeg, bearingToPointDeg, lerpAngleDeg)
  contacts.ts           // SignatureContact creation, triangulation, classification
  survey.ts             // map-survey integration, site discovery
  index.ts
```

**Status:** Directory created, file split, barrel wired, consumers updated. Original `scanning.ts` removed.

### 2.4 `src/docking/` (from `dock.ts`) ✅ COMPLETE

```
src/docking/
  core.ts               // getDockableStation, dock/undock state transitions
  warp.ts               // warpTo, warp cooldown, warp screen coordination
  index.ts
```

**Status:** Directory created, file split, barrel wired, consumers updated. Original `dock.ts` removed.

### 2.5 `src/tutorial/` (from `tutorial.ts`) ✅ COMPLETE

```
src/tutorial/
  runner.ts             // main update loop, step evaluation, snapshot state
  hangar-tour.ts        // beginHangarReviewTour, markHangarReviewComplete
  events.ts             // bindTutorialEvents, event listeners
  index.ts
```

**Status:** Directory created, file split, barrel wired, consumers updated. Original `tutorial.ts` removed. **Note:** A bug was discovered and fixed in `src/tutorial/index.ts` where `canAdvanceHangarTour` and `advanceHangarTutorialPanel` were incorrectly re-exported from `./runner.js` instead of `./hangar-tour.js`.

### 2.6 `src/input/` (from `input.ts`) ✅ COMPLETE

```
src/input/
  core.ts               // InputState, key/mouse tracking, UI blocking, cursor lock
  bindings.ts           // keybind mapping, keydown/keyup handlers
  mouse.ts              // mouse handlers (down, up, move, wheel, contextmenu, blur)
  index.ts              // initInput, re-exports
```

**Status:** Directory created, file split into 3 modules (core.ts, bindings.ts, mouse.ts) plus barrel `index.ts`. Consumer `src/main.ts` updated. Original `input.ts` removed. Note: `sim/input.ts` remains separate as it's simulation-side frame action queuing.

### 2.7 `src/player/player-data.ts` (497 lines → 276 lines) ✅ COMPLETE

Extracted save-format migrations and player initialization into focused modules.

```
src/player/
  player-data.ts                  // Player interface, save/load, migration entry point
  player-factory.ts               // Player initialization and default state creation
  migrations/
    hardpoint-migrations.ts         // Hardpoint layout migration (68 lines)
    refined-cargo-migration.ts    // Refined cargo save migration (28 lines)
    refinery-storage-migration.ts  // Refinery storage migration (28 lines)
```

**Status:** Migrations extracted to `src/player/migrations/`, player initialization extracted to `src/player/player-factory.ts` (117 lines). All consumers updated. `player-data.ts` reduced from 497 to 276 lines. No barrel `index.ts` added (subdirectory is leaf-only, consumers import deep files).

### 2.8 `src/net/client-session.ts` (622 lines → 319 lines) ✅ COMPLETE

Decomposed monolithic session handler into single-concern networking modules.

```
src/net/
  client-session.ts     // Session orchestrator only (connection, handshake, disconnect)
  game-fx-handler.ts    // Game effect message handler (88 lines)
  snapshot-handler.ts   // Snapshot apply orchestrator (88 lines)
  remote-players.ts     // Remote player join/leave handlers (26 lines)
  character-sync.ts     // Character appearance synchronization (23 lines)
  chat-handler.ts       // Chat and typing indicator handler (48 lines)
```

**Status:** Extracted 5 handler modules from `client-session.ts`. All consumers updated. `client-session.ts` reduced from 622 to 319 lines. No barrel needed; `net/` already imports from individual files.

---

## Phase 3 — Render decomposition (medium risk, high readability)

### 3.1 `src/render/enemy/` (from `pixi-entities.ts`)

```
src/render/enemy/
  bake.ts               // bakeEnemyTexture, _texCache, lightDirIndex
  render.ts             // syncPixiEntities, enemy sprite sync, overlays
  index.ts              // initPixiEntities, clearEnemyTextureCaches, refreshEntityFonts
  index.ts
```

Rename: `pixi-entities.ts` is really enemies. The new directory makes that explicit.

### 3.2 `src/render/celestial/` (from `pixi-celestial.ts`)

```
src/render/celestial/
  star.ts               // star rendering, lens flare
  planets.ts            // planet rendering (absorb existing pixi-planets.ts)
  nebula.ts             // nebula GPU layer
  dust.ts               // dust particles
  background.ts         // parallax background (absorb existing background.ts)
  index.ts
```

### 3.3 `src/render/player/` (from `pixi-player.ts`)

```
src/render/player/
  ship.ts               // player ship hull, turret hardpoints
  boost.ts              // boost visual effect
  thrusters.ts          // engine nozzle flames (absorb or coordinate with pixi-thrust.ts)
  index.ts
```

### 3.4 `src/render/combat/` (from `pixi-combat.ts`)

```
src/render/combat/
  bullets.ts            // bullet / missile sprites
  beams.ts              // beam weapon visuals
  explosions.ts         // explosion sprites
  impacts.ts            // hit effects, impact decals
  index.ts
```

### 3.5 `src/render/fx/` (from `pixi-effects.ts`)

```
src/render/fx/
  particles.ts          // generic particles
  shockwaves.ts         // shockwave rings
  float-text.ts         // floating combat text
  trails.ts             // projectile trails
  index.ts
```

---

## Phase 4 — State cleanup (low risk)

### 4.1 `src/state/types/` (from `state.ts`)

```
src/state/types/
  materials.ts          // BulkMaterialStack, RefineryStorageUnit, RefiningHeatMode, etc.
  player.ts             // Player interface fields
  world.ts              // System, Station, Enemy, Asteroid, etc.
  combat.ts             // Bullet, Beam, Particle, WreckPiece, etc.
  client.ts             // Client interface fields
  hub.ts                // HubJob, HubDeposit, HubOutput, etc.
  index.ts
```

`state.ts` shrinks to `G` / `Client` declarations plus re-exports from `./types/index.js`.

### 4.2 `src/state/actions/` (from `state/actions.ts`)

```
src/state/actions/
  economy.ts            // buy/sell/material transactions
  crafting.ts           // craft job creation & ticking
  missions.ts           // mission contract mutations
  inventory.ts          // cargo add/remove, module fitting
  index.ts
```

---

## Phase 5 — Remaining root-level files

After Phases 1–4, the following root files remain. Most are small enough to keep:

| File | Size | Action |
|------|------|--------|
| `combat.ts` | 4 KB | Keep or split into `combat/` (already exists; maybe merge) |
| `constants.ts` | 2 KB | Keep |
| `events.ts` | 2 KB | Keep (event bus) |
| `feedback.ts` | 2 KB | Keep or move to `ui/feedback.ts` |
| `game-loop.ts` | <1 KB | Keep |
| `main.ts` | 4 KB | Keep (entry point) |
| `map-discovery.ts` | 7 KB | Move to `world/map-discovery.ts` |
| `physics.ts` | 3 KB | Keep (simulation tick wrapper) |
| `pixi.ts` | 8 KB | Keep (PixiJS app init) |
| `player-registry.ts` | 1 KB | Keep |
| `salvager.ts` | 4 KB | Move to `player/salvager.ts` or `wreck/salvager.ts` |
| `state-access.ts` | <1 KB | Keep (barrel) |
| `state.ts` | ~3 KB (after split) | Keep |
| `targeting.ts` | <1 KB | Keep or merge into `combat/` |
| `tractor.ts` | 5 KB | Move to `player/tractor.ts` |
| `world-gen.ts` | <1 KB | Keep |

---

## Verification Strategy

After each phase:

1. **`npm run typecheck`** — catch broken imports immediately.
2. **`npm run test:run`** — ensure no runtime regressions.
3. **Grep for stale imports** — search for old file paths in import statements.
4. **Smoke test** — `npm run dev`, open station/industry, verify UI renders.

---

## Rollback Plan

Because this is pure code motion, each phase should be a single commit. If something breaks, revert that commit. Do not stack multiple phases in one commit.

---

## Recommended Order of Execution

1. **Phase 1** first (strings + industry UI) — zero runtime risk, immediate file-size wins.
2. **Phase 2** next (root domains) — mechanical, but touches the most import sites.
3. **Phase 3** (render split) — do this when you have time to visually verify in-game.
4. **Phase 4** (state types/actions) — low risk, can happen anytime after Phase 2.
5. **Phase 5** (remaining tidy-up) — final sweep.
