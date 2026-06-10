# Architecture Overview

## State Management

All mutable game state lives in `src/state.ts` as the global singleton `G`. Modules
read from `G` directly but **must not write to `G.*` fields directly**. All writes go
through the domain-specific accessors in `src/state-access.ts`:
- `PlayerAccess` — player vitals, fitting, resources, skills
- `WorldAccess` — warp state, galaxy, background stars, spatial grid, player init
- `MiningAccess` — mining laser state
- `SalvagerAccess` — salvager beam state
- `TractorAccess` — tractor beam state
- `NavAccess` — navigation command state

**State access is modularized** in `src/state/access/`:
- `read-only.ts` — Read-only state interface via `getState()`
- `player/` — Player state access (core, economy, fitting, multiplayer, tutorial-scanning)
- `world.ts` — World state access
- `mining.ts` — Mining laser state access
- `salvager.ts` — Salvager beam state access
- `tractor.ts` — Tractor beam state access
- `nav.ts` — Navigation command state access

Exception: `G._statsCache` is internal to `player-stats.ts`.

**Player registry:** `G.players` is a `Map<string, Player>` of all sim participants.
`G.P` is a stable alias to the local human (`LOCAL_PLAYER_ID` in `src/player-registry.ts`).
Boot via `WorldAccess.initPlayer()` / `installLocalPlayer()`; tests use `installTestPlayer()`.
Remote stubs use `PlayerAccess.addServerPlayer()`; never remove `LOCAL_PLAYER_ID` on disconnect.

When adding new state, prefer player-owned fields on `Player` (warp, beams, fitting) or
world-owned fields on `G` (bullets, galaxy, wrecks). Add accessors in `src/state/access/`.
Keep simulation entities (`bullets`, `beams`, `particles`) separate from UI/client state
(held in `Client`: `stationOpen`, `bridgeOpen`, etc.).

**Simulation entry:** Only `src/sim/index.ts` drives a full physics step (`Simulation.tick`).
`src/physics.ts` exports `simulationTick` for internal use by `Simulation` only (server worker).
Clients (SP via local worker, MP host/client): send input frames, prediction, and interpolation only.

**Authoritative runtime model (current):**
- Server worker owns gameplay/economy mutation via `queueFrameAction` → `executeGameCommand` → `Simulation.tick`.
- Client UI/HUD/input can read `G.P`, but should not apply gameplay mutations as truth.
- Snapshot apply (`src/net/client.ts`) is the canonical state source for the local player between predictions.
- Station contracts are server-issued offers (`stationOffers`/`stationOfferStationId`) and accepted by `contractId`.

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

## Architecture Fitness Functions

High-value architecture rules must be machine-enforced, not doc-only.
The baseline enforcement runs in `npm run lint` via `scripts/check-gp-boundaries.ts`.

Current enforced checks:
- `simulation-authority` / `server-authority`: `src/sim/**` and `src/server/**` cannot use `G.P`.
- `ui-sim-command-boundary`: `src/ui/**` cannot import directly from `sim/commands`.
- `entity-lifecycle-boundary`: simulation entity arrays (`G.bullets`, `G.beams`, etc.) cannot be mutated outside `src/utils/entities.ts`.
- `state-write-boundary` / `state-array-mutation-boundary`: direct `G.*` / `G.P.*` writes and array mutations are blocked outside state-access modules (with documented exceptions).

When introducing a new architecture rule, add a fitness check when practical, or document why it cannot be statically/runtime enforced yet.

## Event Bus

`src/events.ts` provides a typed event bus (`on` / `off` / `emit` / `offAll`).
Use events for cross-module communication instead of direct state mutations.

**Active events:**

| Event | Emitted by | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `simulation:clear` | `docking/warpTo()`, `utils/game.ts:respawnPlayer()` | — | — |
| `module:toggle` | `player/player-fitting.ts` | — | `{ rack, idx, active, moduleId }` |
| `player:respawn` | `utils/game.ts:respawnPlayer()` | `wreck/collection.ts:closeWreckCargo()` | `{ homeIdx, penalty }` |

## Module Naming Conventions

```
src/
  audio/              Procedural Web Audio SFX
  combat/             Combat subsystem: game logic (damage calc, hit chance) + VFX helpers
  config/             Configuration files (combat, economy, enemies, physics, etc.)
  constants.ts        Game constants
  data/               Pure data definitions (ships, modules, enemies, recipes, etc.)
  docking/            Docking and warp system
  events.ts           Typed event bus for cross-module communication
  feedback.ts         Player feedback system
  game-loop/          Game loop logic (render pass, runtime, multiplayer host)
  game-loop.ts        Game loop entry point
  input/              Input handling system (bindings, core, mouse)
  input-hotkeys.ts    Input hotkey handling
  loot/               Loot generation system
  main.ts             Application entry point
  map-discovery.ts    Map discovery system
  net/                Networking layer (client, session, interpolation, prediction, snapshot apply)
  physics/            Fixed-timestep simulation (ship, npcs, projectiles, collision)
  physics.ts          Physics entry point
  pixi.ts             PixiJS initialization
  player/             Player state: data, stats, fitting, skills, abilities
  player-registry.ts  Player registration
  refinery/           Refinery and hub processing system
  render/             PixiJS WebGL/WebGPU gameplay rendering. All in-game visuals
                      go through Pixi; the screen `<canvas id="c">` and `canvas.ts`
                      were removed in the 2026-06-01 migration.
  salvager.ts         Salvager beam system
  scanning/           Scanning and contact system
  server/             Server code (session management, sanitization, worker)
  sim/                Simulation system (commands, input, snapshot)
  sites/              Sites system (decryption, director, interaction)
  state/              State management with modular accessors
  state-access.ts     State access barrel re-export
  state.ts            Global state definition
  targeting/          Targeting system (assignment, locks, lookup, ranges)
  tractor.ts          Tractor beam system
  tutorial/           Tutorial system with modular step data, logic, and UI overlay
                      data/              Tutorial step definitions, phases, layout, controls, helpers
                      logic/             Tutorial runtime logic (context, events, lifecycle, sync, tick)
                      ui/                Tutorial UI overlay (card, cutout, dimmer, highlights, visuals)
  types/              Shared structural interfaces (entities, world, lock state)
  ui/                 DOM-based overlays (station, bridge, inventory, settings)
  ui/tutorial/        Tutorial UI overlay system
  utils/              Pure utilities (math, spatial grid, FX helpers, camera, entities)
  world/              World generation and population
  world-gen.ts        World generation entry point
  wreck/              Wreck system (collection, pieces, salvage, spawn)
  worker/             Off-main-thread workers (e.g. ticker)
```

## Tutorial System Architecture

The tutorial system is modularized into three layers: data, logic, and UI.

### Data Layer (`src/tutorial/data/`)

Pure data definitions for tutorial content:

- **`steps.ts`** — `TUTORIAL_STEPS` array defining all tutorial steps with objectives, zones, beacons, tours, and completion logic
- **`phases.ts`** — Tour phase definitions (HUD tour, hangar review, combat swap, refinery tour)
- **`layout.ts`** — Tutorial world layout: regions, tracks, boost gates/pads, navigation targets, zone definitions
- **`controls.ts`** — Keybinding helpers for tutorial text (`tutorialKeyStyled`, `tutorialBarKeyStyled`)
- **`bypass.ts`** — Bypass condition checks (mining, industry, hangar turrets, gunnery) for skipping steps
- **`helpers.ts`** — Shared helper functions (zone completion, track progress, step lookup, tour panels)
- **`mission.ts`** — Tutorial mission contracts and reward granting
- **`site.ts`** — Training site definitions and IDs

### Logic Layer (`src/tutorial/logic/`)

Tutorial runtime and state management:

- **`context.ts`** — `TutorialCtx` type and context creation
- **`lifecycle.ts`** — Step lifecycle (enter, exit, complete, advance)
- **`events.ts`** — Tutorial-specific event handling
- **`sync.ts`** — State synchronization between tutorial and game state
- **`tick.ts`** — Per-frame tutorial updates
- **`snapshot.ts`** — Tutorial snapshot state for save/load
- **`tours.ts`** — Tour execution logic (hangar, refinery)
- **`hangar.ts`** — Hangar-specific tour logic

### UI Layer (`src/tutorial/ui/`)

Tutorial visual presentation:

- **`card.ts`** — Tutorial card component (title, objective, hint)
- **`cutout.ts`** — UI element cutout/highlight effects
- **`dimmer.ts`** — Screen dimming overlay
- **`highlights.ts`** — Element highlighting system
- **`visuals.ts`** — Visual effects (beacons, pulses, gate animations)
- **`overlay.ts`** — Main tutorial overlay container
- **`render.ts`** — Tutorial render pass integration
- **`state.ts`** — UI state management
- **`init.ts`** — UI initialization

### Key Patterns

- **Step-driven progression**: Each step has `onEnter`, `isComplete`, and optional `tour` for multi-phase UI tours
- **Zone-based completion**: Many steps complete when the player enters/exits specific spatial regions
- **Bypass support**: Players can skip tutorial sections if they already have the required skills/loadout
- **Snapshot state**: Tutorial progress is persisted in `TutorialSnapshot` (separate from `G.P.tutorialSnapshot`)
- **Tour phases**: Complex UI tours (HUD, hangar, refinery) are broken into phases with panels

## State Access Rules

| State type | Read by | Written by | Notes |
|-----------|---------|-----------|-------|
| `G.bullets`, `G.enemyBullets`, `G.beams`, `G.particles` | render | combat.ts, physics/npcs.ts | Lifecycle via `src/utils/entities.ts` |
| `G.wrecks`, `G.creditPickups`, `G.floatTexts`, `G.impactDecals` | render, wreck.ts | wreck.ts, fx.ts, effects.ts | Lifecycle via `src/utils/entities.ts` |
| `G.P.warpCooldown`, `G.P.warpTargetIdx` | docking, game-loop | docking/warp.ts | Via `PlayerAccess.setWarpCooldown()` / `setWarpTargetIdx()` |
| `G.P.miningLaser`, `G.P.salvager`, `G.P.tractor` | render, wreck.ts | physics/npcs.ts, wreck.ts | Via `MiningAccess` / `SalvagerAccess` / `TractorAccess` (player only) |
| `G.GALAXY`, `G.STARS*`, `G.DUST` | render, docking, physics/npcs.ts | main.ts, render/background.ts | Via `WorldAccess.setGalaxy()` / `setStars()` / etc. |
| `G.P` (alias) | everywhere | main.ts, utils/restore-save.ts | Via `WorldAccess.initPlayer()` → `G.players` + `G.P` |
| `G.players` | physics, spatial, net | main.ts, net client | `registerPlayer()` / `PlayerAccess.addServerPlayer()` |
| `G.spatialGrid` | physics, combat | main.ts | Via `WorldAccess.setSpatialGrid()` |
| `G.P.fitting`, `G.P.moduleCargo` | station/inventory UI, player-stats | `sim/commands.ts` handlers | Client queues commands; snapshot apply mirrors server state |
| `G.P.slotActive` | physics/ship.ts, ui/hud-overlay | ui/hud-overlay.ts | UI-driven only |
| `G.P.shield/hp/structure` | ui/hud-overlay, station | combat/damage-display.ts, station repair | Damage flows through `damagePlayer()` in `combat/damage-display.ts` |
| `G.P.craftQueue` | station/hub industry UI | `sim/commands.ts`, physics.ts | Queue/cancel via commands; completion on server tick |
| `G.P.contracts`, `G.P.stationOffers*` | contracts UI/HUD | `sim/commands.ts` | Offer lifecycle on dock/accept/turn-in/undock |
| `G.P.hubQueue`, `G.P.hubOutput`, `G.P.hubDeposit` | hub UI/HUD | `sim/commands.ts`, physics.ts | Process/smelt/collect are command-driven, ticked server-side |
| `Client.camx/Client.camy` | render | `utils/camera.ts` | Camera update called from `physics/ship.ts` tick |

## Internationalization (i18n)

The game supports English (`en`) and Spanish (`es`). All user-facing strings must go through the translation system rather than being hardcoded.

### Translation Helper

`src/utils/i18n.ts` exports `t(key: string, vars?: Record<string, string | number>): string`.
- `key` uses dot-namespaced convention: `namespace.subkey` (e.g. `hud.shield`, `pause.save`).
- `vars` replaces `{name}`-style placeholders in the translated string.
- If a key is missing for the current language, `t` falls back to returning the key itself.

Example:
```ts
import { t } from "../../utils/i18n.js";

el.textContent = t("hud.shield");
el.textContent = t("hud.jumpTo", { name: sys.name });
```

### Translation Dictionary

All strings live in `src/data/strings/` as namespace files inside the `STRINGS` record:
```ts
export const STRINGS: Record<Language, Record<string, string>> = {
  en: { "hud.shield": "Shield", ... },
  es: { "hud.shield": "Escudo", ... },
};
```

Rules when adding or editing strings:
- **Always add both `en` and `es` entries.** Keep the two blocks in sync (same keys, same order).
- Use descriptive, namespaced keys: `profile.title`, `ship.offline`, `enemyMenu.orbit`.
- For UI labels that apply to multiple contexts, prefer generic keys (e.g., `common.yes`, `common.no`) over duplicating translations.
