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

When adding new state:
1. **Persistent player data** (HP, credits, fitting, skills) → add fields on `Player` with accessors in `src/state/access/`.
2. **World simulation entities** (bullets, beams, particles, asteroids) → use object pooling via `src/utils/entities.ts`.
3. **Ephemeral/render/AI state** per entity → use a **component store** (see Component Stores section below).
4. **UI-only client state** (`stationOpen`, `bridgeOpen`, etc.) → add fields on `Client`.

Keep simulation entities (`bullets`, `beams`, `particles`) separate from UI/client state.

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

## Component Stores (ECS-lite)

Entity types (`Player`, `Enemy`) own only **persistent** simulation state (position, HP, fitting, etc.).
Ephemeral, render-side, or AI-side state lives in dedicated component stores keyed by entity ID.
This prevents entity bloat, simplifies snapshot serialization, and keeps render/AI concerns separate
from the core simulation data model.

### Store pattern

A component store is a module-private `Map<string, T>` with a minimal exported API:

```ts
const _store = new Map<string, MyComponentState>();

export function getMyComponent(id: string): MyComponentState { ... }
export function setMyComponent(id: string, value: MyComponentState): void { ... }
export function removeMyComponent(id: string): void { _store.delete(id); }
export function clearMyComponents(): void { _store.clear(); }
```

**Naming conventions:**
- Module path: `{domain}/{feature}-state.ts` (e.g. `player/input-state.ts`, `render/npc-speech.ts`)
- Getter: `get{Feature}(id)` — returns the value or a default
- Setter: `set{Feature}(id, value)` — writes or deletes (when `value` is `null`)
- Per-entity removal: `remove{Feature}(id)` — called when the entity dies or despawns
- Global clear: `clear{Feature}s()` — called on warp, respawn, or simulation reset

**Lifecycle rules:**
- `removeXxx(id)` must be called in every code path that destroys the entity (combat kill, despawn, etc.).
- `clearXxx()` must be wired into `clearSimulationEntities()` (`src/utils/entities.ts`) and `warp-exec.ts`.
- Player-owned stores must also be cleared in `clearTransientPlayerInput()` (`src/player/player-data.ts`).

### Current stores

| Store | Path | Owner | Purpose |
|-------|------|-------|---------|
| `entity-visuals` | `src/render/entity-visuals.ts` | Enemy/Player | Shield/hull hit flash state for Pixi render |
| `npc-speech` | `src/render/npc-speech.ts` | Enemy/Neutral | Floating hail/speech bubble text + expiry |
| `ai-state` | `src/physics/npcs/ai-state.ts` | Enemy | AI behavior flags (targeting, lock timers, aim state) |
| `task-state` | `src/physics/npcs/task-state.ts` | Enemy | Patrol/mining/task timers and waypoints |
| `input-state` | `src/player/input-state.ts` | Player | Input frame cache (keys, mouse, waypoint, navCommand) |
| `collision-state` | `src/player/collision-state.ts` | Player | Collision damage cooldown timer |
| `target-selection` | `src/player/target-selection.ts` | Player | Selected lock target for module assignment |

**When to add a new store:**
1. The state is ephemeral (does not need to be saved/loaded).
2. The state is read by a subsystem that is not the owner (e.g. render reads AI state).
3. The state would otherwise be prefixed with `_` on the entity type.
4. The state has per-entity lifecycle requirements (spawn on entity creation, cull on death).

### What NOT to put in a component store

- **Persistent player state** (HP, credits, fitting, skills) stays on `Player` and mutates through `PlayerAccess`.
- **World-owned simulation entities** (bullets, beams, particles, asteroids) use object pooling in `src/utils/entities.ts`.
- **UI-only client state** (`Client.stationOpen`, `Client.settingsOpen`) stays in `Client`.

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
  loot/               Module generation (loot drops, affixes, rarity)
  main.ts             Application entry point
  net/                Networking layer (client, session, interpolation, prediction, snapshot apply)
                        client.ts           Main client connection and message routing
                        client-session.ts   Session orchestrator (connection, handshake, disconnect)
                        client-transport.ts Transport abstraction (WebSocket / relay)
                        codec.ts            Binary messagePack / JSON codec with fallback
                        game-fx-handler.ts  Game effect message handler (explosions, impacts, sounds)
                        snapshot-handler.ts Snapshot apply orchestrator
                        snapshot-apply/     Snapshot apply subsystem (local-player, remote-players, entities, projectiles, wreck-salvage)
                        remote-peers.ts     WebRTC peer management
                        remote-players.ts   Remote player join/leave handlers
                        character-sync.ts   Character appearance synchronization
                        chat-handler.ts     Chat and typing indicator handler
                        interpolation.ts    Entity interpolation for remote players
                        prediction.ts       Client-side input prediction
                        session-discovery.ts LAN / relay session discovery
  physics/            Fixed-timestep simulation (ship, npcs, projectiles, collision)
  physics.ts          Physics entry point
  pixi.ts             PixiJS initialization
  player/             Player state: data, stats, fitting, skills, abilities
                        player-data.ts      Player interface, save/load, migration entry point
                        player-factory.ts   Player initialization and default state creation
                        player-stats.ts     Derived stat calculations and cache
                        player-fitting.ts   Module fitting / unfitting logic
                        abilities.ts        Active ship abilities
                        boost-module.ts     Boost ability implementation
                        init.ts             Player boot helpers
                        migrations/         Save-format migration scripts
                          hardpoint-migrations.ts
                          refined-cargo-migration.ts
                          refinery-storage-migration.ts
  player/salvager.ts  Salvager beam system
  player/tractor.ts   Tractor beam system
  player-registry.ts  Player registration
  refinery/           Refinery and hub processing system
  render/             PixiJS WebGL/WebGPU gameplay rendering. All in-game visuals
                      go through Pixi; the screen `<canvas id="c">` and `canvas.ts`
                      were removed in the 2026-06-01 migration.
                      Offscreen Canvas2D is allowed only for baking Pixi textures,
                      icons, and small UI previews; it must not be used as a
                      gameplay renderer or via the removed `#c` screen canvas.
  scanning/           Scanning and contact system
  server/             Server code (session management, sanitization, worker)
  sim/                Simulation system (commands, input, snapshot)
  sites/              Sites system (decryption, director, interaction)
  state/              State management with modular accessors
  state-access.ts     State access barrel re-export
  state.ts            Global state definition
  state/actions/      Server-authoritative action handlers (economy, crafting, missions, inventory)
  targeting/          Targeting system (assignment, locks, lookup, ranges)
  tutorial/           Tutorial system with modular step data, logic, and UI overlay
                      data/              Tutorial step definitions, phases, layout, controls, helpers
                      logic/             Tutorial runtime logic (context, events, lifecycle, sync, tick)
                      ui/                Tutorial UI overlay (setup, card, spotlight, visuals, render, lifecycle, frame-loop)
  types/              Shared structural interfaces (entities, world, lock state)
  ui/                 DOM-based overlays (station, bridge, inventory, settings)
  tutorial/ui/        Tutorial UI overlay system (setup, card, spotlight, visuals, render, lifecycle, frame-loop)
  utils/              Pure utilities (math, spatial grid, FX helpers, camera, entities, pool)
  world/              World generation and population
                      galaxy-build.ts    Galaxy construction and sector layout
                      hidden-sites.ts    Hidden site management and discovery
                      map-discovery.ts   Map discovery, sector/local region visibility
                      system-populate.ts System population (enemies, asteroids, stations)
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

## State Actions System (`src/state/actions/`)

Server-authoritative action handlers that validate and execute player-initiated operations.
These actions are called by `sim/commands.ts` handlers and must use state accessors to mutate state.

### Economy Actions (`economy.ts`)

- **`repairShipAction`** — Repair hull, structure, shield, and module durability
- **`buyModuleAction`** — Purchase a module from station market
- **`sellModuleAction`** — Sell an unfitted module to station market
- **`buyAmmunitionAction`** — Purchase hybrid or missile ammunition
- **`sellCargoResourceAction`** — Sell ore, loot, or components
- **`setHomeSystemAction`** — Set current system as home for respawn

### Crafting Actions (`crafting.ts`)

- **`queueIndustryJobAction`** — Queue a refinery/hub processing job
- **`tickIndustryQueue`** — Process industry queue on server tick
- **`cancelIndustryJobAction`** — Cancel a queued industry job
- **`buyBlueprintAction`** — Purchase a blueprint for crafting

### Mission Actions (`missions.ts`)

- **`acceptContractAction`** — Accept a station contract
- **`acceptContractProposalAction`** — Accept a contract proposal from mission system
- **`turnInContractAction`** — Turn in a completed contract
- **`abandonContractAction`** — Abandon an active contract

### Inventory Actions (`inventory.ts`)

- **`fitModuleAction`** — Fit a module to a ship slot
- **`unfitModuleAction`** — Remove a module from a ship slot
- **`swapModuleAction`** — Swap modules between slots
- **`jettisonItemAction`** — Jettison cargo/modules into space

## World Generation System (`src/world/`)

World construction and population subsystems.

### Galaxy Construction (`galaxy-build.ts`)

- Builds the galaxy structure with concentric sectors
- Places warp gates between sectors
- Configures sector security levels and connections

### Hidden Sites (`hidden-sites.ts`)

- Manages hidden site discovery and lifecycle
- Handles site state transitions (hidden → resolved → cleared)
- Spawns site-specific content (enemies, loot)

### Map Discovery (`map-discovery.ts`)

- **Sector discovery**: Track which concentric sectors are discovered
- **Local region discovery**: Track POIs within sectors (mining belts, combat zones)
- **Scan-based discovery**: Reveal regions via scanner cone
- **Map bounds**: Compute visible map bounds based on discovered content
- **Waypoint validation**: Ensure waypoints are only set in allowed areas

### System Population (`system-populate.ts`)

- Populates systems with asteroids, enemies, and stations
- Generates appropriate content based on sector security
- Handles respawn logic for dynamic entities

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
| `G.P.shield/hp/structure` | ui/hud-overlay, station | combat/damage-display.ts, station repair | Damage flows through `damagePlayer()` in `combat/damage-display.ts` |
| `G.P.craftQueue` | station/hub industry UI | `sim/commands.ts`, physics.ts | Queue/cancel via commands; completion on server tick |
| `G.P.contracts`, `G.P.stationOffers*` | contracts UI/HUD | `sim/commands.ts` | Offer lifecycle on dock/accept/turn-in/undock |
| `G.P.hubQueue`, `G.P.hubOutput`, `G.P.hubDeposit` | hub UI/HUD | `sim/commands.ts`, physics.ts | Process/smelt/collect are command-driven, ticked server-side |
| `Client.camx/Client.camy` | render | `utils/camera.ts` | Camera update called from `physics/ship.ts` tick |

## Network Serialization

All WebSocket wire traffic uses `msgpackr` binary encoding through `src/net/codec.ts`.

### Why msgpackr?
- **Smaller payloads**: 20-40% smaller than JSON for snapshot/delta traffic.
- **Faster serialization**: msgpackr is typically 2-5x faster than `JSON.stringify` for large objects.
- **No UTF-8 overhead**: Binary frames skip the string encoding step.

### Usage
```ts
import { encodeNetMessage, decodeNetMessage } from "./codec.js";

// Send
const bytes = encodeNetMessage({ type: "snapshot", payload: { tick, player, entities } });
socket.send(bytes);

// Receive (ArrayBuffer because binaryType = "arraybuffer")
const envelope = decodeNetMessage(e.data);
```

### Path rules
- **WebSocket direct** (browser ↔ server): binary msgpackr.
- **Worker postMessage** (client ↔ server-worker): structured clone (no codec).
- **Tauri relay** (host JS ↔ Rust bridge): JSON strings. The Rust WebSocket server (`src-tauri/src/net.rs`) currently sends/receives `Message::Text` only and the Tauri `invoke`/`emit` bridge uses `String` payloads. Full end-to-end binary on this path would require Rust-side changes to handle `Message::Binary` and pass raw bytes through the Tauri IPC layer.

### Known limitations
- The Tauri remote host path does not yet use binary WebSocket frames. This is a future optimization requiring changes to `src-tauri/src/net.rs` (handle `Message::Binary`, update `ClientEvent` payload type, and coordinate with `src/game-loop/multiplayer-host.ts`). The local single-player path is already optimal (structured clone).

### Fallback
`setUseBinaryCodec(false)` forces JSON encoding/decoding. This is useful for:
- Debugging with network inspectors that can't read MessagePack.
- Transition periods where the server may still send JSON.
- Emergency rollback without reverting code.

## Entity Lifecycle & Object Pooling

Simulation entities with high spawn/cull rates (bullets, particles, beams, shockwaves, float texts, trails) must use object pooling.

### Pool integration
- **Creation**: `addBullet()`, `addParticle()`, etc. acquire from `ObjectPool<T>` in `src/utils/pool.ts`.
- **Destruction**: `removeBullet()`, etc. return dead objects to their pool.
- **Bulk clear**: `clearSimulationEntities()` releases all live objects before `arr.length = 0`.

### Why pooling matters
A single minigun volley can spawn 30+ bullets. Without pooling, that is 30+ object allocations. Over a 5-minute combat session, allocation pressure can trigger GC pauses that manifest as frame stutters. With pooling, spawn becomes a simple pop from a free list.

### O(1) culling
Reverse-iteration culling loops (e.g., `updateProjectiles`) must use swap-and-pop instead of `splice()`:
```ts
const dead = arr[i];
const lastIdx = arr.length - 1;
if (i < lastIdx) arr[i] = arr[lastIdx]!;
arr.length--;
pool.release(dead);
if (i < lastIdx) i++; // process the swapped-in item
```

## Render System Registries

Pixi initialization and frame rendering are registry-driven:
- `src/render/pixi-render-systems.ts` owns Pixi system init/destroy ordering.
- `src/render/space-frame-system-order.ts` owns per-frame render timing order.
- `src/render/space-frame-systems.ts` maps each timed frame section to its render sync function.

When adding a gameplay render subsystem, add the init/destroy lifecycle to `pixi-render-systems.ts`, add the per-frame section id to `SPACE_FRAME_SYSTEM_IDS`, map the id in `space-frame-systems.ts`, and add matching `perf.section.<id>` strings. Render systems must read server-owned state and update presentation objects only; simulation outcomes stay in physics/server-owned code.

## Physics System Registry

`src/physics.ts` delegates tick execution to a declarative `SimSystem[]` registry in `src/physics/systems.ts`.

### Adding a system
```ts
export const SIMULATION_SYSTEMS: SimSystem[] = [
  // ... existing systems ...
  { id: "myFeature", category: "physics", run: updateMyFeature },
];
```

### Benefits
- **Discoverability**: New developers see every tick system in one list.
- **Timing**: The registry loop can inject per-system `performance.now()` marks for the perf overlay.
- **Testability**: Individual systems can be run in isolation by importing their `run` function.

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
