# Architecture Overview

## State Management

All mutable game state lives in `src/state.ts` as the global singleton `G`. Modules
read from `G` directly but **must not write to `G.*` fields directly**. All writes go
through the domain-specific accessors in `src/state-access.ts`:
- `PlayerAccess` — player vitals, fitting, resources, skills
- `WorldAccess` — warp state, galaxy, background stars, spatial grid, player init
- `MiningAccess` — mining laser state
- `SalvagerAccess` — salvager beam state

Exception: `G._statsCache` is internal to `player-stats.ts`.

**Player registry:** `G.players` is a `Map<string, Player>` of all sim participants.
`G.P` is a stable alias to the local human (`LOCAL_PLAYER_ID` in `src/player-registry.ts`).
Boot via `WorldAccess.initPlayer()` / `installLocalPlayer()`; tests use `installTestPlayer()`.
Remote stubs use `PlayerAccess.addServerPlayer()`; never remove `LOCAL_PLAYER_ID` on disconnect.

When adding new state, prefer player-owned fields on `Player` (warp, beams, fitting) or
world-owned fields on `G` (bullets, galaxy, wrecks). Add accessors in `state-access.ts`.
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

## Event Bus

`src/events.ts` provides a typed event bus (`on` / `off` / `emit` / `offAll`).
Use events for cross-module communication instead of direct state mutations.

**Active events:**

| Event | Emitted by | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `simulation:clear` | `dock.ts:warpTo()`, `utils/game.ts:respawnPlayer()` | — | — |
| `module:toggle` | `player/player-fitting.ts` | — | `{ rack, idx, active, moduleId }` |
| `player:respawn` | `utils/game.ts:respawnPlayer()` | `wreck.ts:closeWreckCargo()` | `{ homeIdx, penalty }` |

## Module Naming Conventions

```
src/
  combat/          Combat subsystem: game logic (damage calc, hit chance) + VFX helpers
  data/            Pure data definitions (ships, modules, enemies, recipes, etc.)
  events.ts        Typed event bus for cross-module communication
  physics/         Fixed-timestep simulation (ship, npcs, projectiles, collision)
  player/          Player state: data, stats, fitting, skills
  render/          PixiJS WebGL/WebGPU gameplay rendering. All in-game visuals
                   go through Pixi; the screen `<canvas id="c">` and `canvas.ts`
                   were removed in the 2026-06-01 migration.
  types/           Shared structural interfaces (entities, world, lock state)
  ui/              DOM-based overlays (station, bridge, inventory, settings)
  utils/           Pure utilities (math, spatial grid, FX helpers, camera, entities)
  audio/           Procedural Web Audio SFX
  worker/          Off-main-thread workers (e.g. ticker)
```

## State Access Rules

| State type | Read by | Written by | Notes |
|-----------|---------|-----------|-------|
| `G.bullets`, `G.enemyBullets`, `G.beams`, `G.particles` | render | combat.ts, npcs.ts | Lifecycle via `src/utils/entities.ts` |
| `G.wrecks`, `G.creditPickups`, `G.floatTexts`, `G.impactDecals` | render, wreck.ts | wreck.ts, fx.ts, effects.ts | Lifecycle via `src/utils/entities.ts` |
| `G.P.warpCooldown`, `G.P.warpTargetIdx` | dock.ts, game-loop.ts | dock.ts | Via `PlayerAccess.setWarpCooldown()` / `setWarpTargetIdx()` |
| `G.P.miningLaser`, `G.P.salvager`, `G.P.tractor` | render, wreck.ts | physics/npcs.ts, wreck.ts | Via `MiningAccess` / `SalvagerAccess` / `TractorAccess` (player only) |
| `G.GALAXY`, `G.STARS*`, `G.DUST` | render, dock.ts, npcs.ts | main.ts, background.ts | Via `WorldAccess.setGalaxy()` / `setStars()` / etc. |
| `G.P` (alias) | everywhere | main.ts, restore-save | Via `WorldAccess.initPlayer()` → `G.players` + `G.P` |
| `G.players` | physics, spatial, net | main.ts, net client | `registerPlayer()` / `PlayerAccess.addServerPlayer()` |
| `G.spatialGrid` | physics, combat | main.ts | Via `WorldAccess.setSpatialGrid()` |
| `G.P.fitting`, `G.P.moduleCargo` | station/inventory UI, player-stats | `sim/commands.ts` handlers | Client queues commands; snapshot apply mirrors server state |
| `G.P.slotActive` | physics/ship.ts, hud-overlay | hud-overlay.ts | UI-driven only |
| `G.P.shield/hp/structure` | hud-overlay, station | damage-display.ts, station repair | Damage flows through `damagePlayer()` in `combat/damage-display.ts` |
| `G.P.craftQueue` | station/hub industry UI | `sim/commands.ts`, `physics.ts` | Queue/cancel via commands; completion on server tick |
| `G.P.contracts`, `G.P.stationOffers*` | contracts UI/HUD | `sim/commands.ts` | Offer lifecycle on dock/accept/turn-in/undock |
| `G.P.hubQueue`, `G.P.hubOutput`, `G.P.hubDeposit` | hub UI/HUD | `sim/commands.ts`, `physics.ts` | Process/smelt/collect are command-driven, ticked server-side |
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

All strings live in `src/data/strings.ts` inside the `STRINGS` record:
```ts
export const STRINGS: Record<Language, Record<string, string>> = {
  en: { "hud.shield": "Shield", ... },
  es: { "hud.shield": "Escudo", ... },
};
```

Rules when adding or editing strings:
- **Always add both `en` and `es` entries.** Keep the two blocks in sync (same keys, same order).
- Use descriptive, namespaced keys: `profile.title`, `ship.offline`, `enemyMenu.orbit`.
- For UI labels that appear together, keep them under the same namespace (e.g. `profile.*` for the profile screen).
- Run `npm run typecheck` after editing `strings.ts` to catch syntax issues.

### Current Language

`Client.settings.language` is the source of truth. It is persisted via `saveSettings()` and reloaded on boot. Changing the language triggers a full page reload so all UI strings re-render from `t()`.

### Auditing for Untranslated Strings

When adding new UI features:
1. Search the file for raw English text in `innerHTML`, `textContent`, `confirm()`, `alert()`, `prompt()`, and `logEvent()` calls.
2. Add the required keys to `src/data/strings.ts` (both languages).
3. Replace the hardcoded text with `t("key")` or `t("key", { var: value })`.

## Adding New Content

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

## Key Patterns

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
