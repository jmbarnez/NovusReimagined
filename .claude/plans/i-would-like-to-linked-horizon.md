# Ambient Faction Ships

## Context

The starter system (`sys-0`) currently feels static apart from hostile spawn zones. We want to bring it to life with **neutral faction ships** that warp in through gates, do believable activities (dock at the station, mine asteroids, patrol/escort), occasionally skirmish with the system's hostiles, then casually leave. A subset of them carry an exclamation marker meaning the player can *hail* them — and if the player has the right comms equipment, hailing pops a short speech bubble with filler flavor text (a space joke for now).

Design intent (from the user): keep the population low — at most ~1–2 ships transiting in/out and ~1–2 doing activities at any time. These are primarily *ambient* NPCs.

Confirmed scope decisions:
- **Full two-way combat** — hostiles also target/fire on neutral ships, and neutral ships can be destroyed by them (not just one-sided).
- **Targetable + in overview** — neutral ships are lockable/clickable and appear in the overview with a neutral (green) color.
- **Hail = speech bubble** above the ship for a few seconds (reusing world-space text), gated behind a comms module.

## Approach

Reuse the existing `Enemy` entity + render + combat + spatial infrastructure rather than building a parallel system. Neutral ships are stored in the **same `sys.enemies` array** with a new `faction` discriminator, so they automatically get: spatial-grid indexing, the Pixi render bundle, separation/asteroid-avoidance, lock/targeting, and `damageEnemy()` for taking damage. We add surgical `faction`-aware branches to the shared systems and a dedicated ambient AI + a small director that schedules spawns/despawns.

The central combat refactor: generalize the hostile AI's hardcoded "target = the player" assumption into a chosen combat target (player **or** an opposing-faction ship), and make NPC bullets faction-aware so they damage whichever opposing combatant they hit.

### Data model

`src/types/world.ts` — extend `Enemy`:
- `faction?: "hostile" | "neutral"` (absent ⇒ hostile, preserving all current behavior).
- Ambient scratch: `_task?: "transit-in" | "goto-station" | "dwell" | "mine" | "patrol" | "engage" | "depart"`, `_taskTimer?: number`, `_wpX?/_wpY?` (current waypoint), `_exitGateIdx?: number`, `_mineTargetId?: string`.
- Interaction: `hailable?: boolean`, `_speech?: { text: string; until: number }`.
- `commsRange?: number` (hail proximity, optional).

No new `System` array — neutral ships live in `sys.enemies`. Despawn = remove from `sys.enemies` + `sys._enemyMap` (the render bundle auto-destroys when the id leaves `_liveEnemies`).

### Faction ship definitions (reuse texture baking + fitting)

`src/data/enemies.ts` — add a few faction ship `EnemyDef`s (e.g. `faction_hauler`, `faction_miner`, `faction_escort`, `faction_scout`) with their own `render` config (distinct neutral palette — teal/blue), `colRadius`, `speed`, `engagement`, and (for combat-capable ones) `slots` + `moduleLoot` so the existing `buildEnemyFitting()` ([src/utils/spawn.ts](src/utils/spawn.ts)) arms them. These are *never* referenced by `ENEMY_SPAWNS`, so they only appear via the director. `bakeEnemyTexture()`/`getEnemyTexture()` in [src/render/pixi-entities.ts](src/render/pixi-entities.ts) work unchanged because they key off `ENEMY_DEFS[type].render`.

`src/data/faction-comms.ts` (new) — arrays of neutral ship names and ~10–15 space-joke / filler lines; a `randomHailLine()` helper.

`src/combat/factions.ts` (new) — `isHostile(aFaction, bFaction)` relationship helper (player vs hostile, neutral vs hostile = enemies; neutral vs player = friendly). Keeps faction logic in one place.

### Ambient AI + director

`src/physics/ambient-ships.ts` (new):
- `processAmbientBehavior(e, dt)` — state machine driving movement via the existing engagement-style thrust/turn math (reuse `angleDiff`, waypoint steering): `transit-in` (fly from entry gate toward an activity anchor) → activity (`goto-station`+`dwell`, `mine`, or `patrol`) → `depart` (fly to an exit gate, then despawn when within gate radius). If a hostile comes within engagement range and the ship is combat-capable (escort/scout), switch to `engage`; non-combat ships (hauler/miner) `depart` early (flee). Mining reuses asteroid lookup from `sys._asteroidMap`/`liveAsteroids()` and applies a cosmetic mining beam (no ore to player).
- `updateAmbientDirector(dt)` — module-level scheduler. Counts live neutral ships in `sys.enemies`; maintains caps (≤2 transiting, ≤2 active) using tunables; on a randomized cadence spawns a new neutral ship at a random gate via a `buildFactionShip()` helper (mirrors `buildEnemyFromSpawn()` in [src/utils/spawn.ts](src/utils/spawn.ts) but sets `faction:"neutral"`, a task, an exit gate, and `hailable` with some probability). Only runs in `sys-0` for now (gated by `sys.idx === 0`).

Wire `updateAmbientDirector(dt)` into the tick sequence in [src/physics.ts](src/physics.ts) alongside `updateNpcs`.

### Two-way combat generalization

[src/physics/npc-ai.ts](src/physics/npc-ai.ts):
- Top of `processNpcBehavior`: `if (e.faction === "neutral") { processAmbientBehavior(e, dt); return; }`.
- Extract the weapon-firing block (currently lines ~123–163) into a shared `fireTurretsAt(e, target, dt, detectionRange)` helper that takes a target `{x,y,vx,vy}` and an `applyHit(dmg, hitX, hitY)` callback. Beam path calls `applyHit` instead of `damagePlayer` directly; bullet path stamps `ownerFaction`/`ownerId` on the spawned bullet.
- Hostile target selection: replace the hardcoded `G.P` with `pickHostileTarget(e)` → nearest of {player, neutral ships within detection} using a spatial-grid query. Player-facing state (`targetingPlayer`/`hasLockOnPlayer`, locking SFX, attack-warning pulse) stays bound to the **player** target only; NPC-vs-NPC engagement uses immediate (no lock ceremony) firing to avoid spurious "under attack" cues.
- Ambient `engage` state calls the same `fireTurretsAt` against the nearest hostile, with `applyHit → damageEnemy(target, …)`.

[src/physics/npcs.ts](src/physics/npcs.ts):
- `updateEnemyBullets`: make faction-aware. For each bullet, consider the player **and** nearby opposing-faction ships (grid query), skip same-faction/owner, and on hit route to `damagePlayer` (player) or `damageEnemy` (ship). Keep the existing asteroid-blocking CCD.
- `applyNpcStationEvasion`: skip `faction === "neutral"` so ambient ships may approach/dock at the station (alongside the existing `type !== "drone"` guard).
- `updateEnemyRespawns`: skip neutrals — they despawn rather than respawn in place.

[src/combat.ts](src/combat.ts) `killEnemy`: guard the player-reward path (kills/XP/mission progress/`+XP` float) so destroyed **neutral** ships don't grant bounty/mission credit. Keep explosion/wreck. (`damageEnemy` itself already works on any `Enemy`, so no change needed for ships taking damage.)

### Rendering: neutral identity, exclamation, speech

[src/render/pixi-entities.ts](src/render/pixi-entities.ts) `syncPixiEntities` + `EnemyBundle`:
- Faction-aware labels: neutral ships use a green name style and suppress the level badge (show a faction tag or just the name box).
- Add an `exclamation` Graphics to the bundle: drawn above the ship (reuse the `iy - 40` indicator slot pattern) when `e.faction === "neutral" && e.hailable && hasCommsEquipment()`.
- Add a `speechText` Text (or reuse world-text) shown above the ship while `e._speech && now < e._speech.until`.

### Comms equipment + hail trigger

[src/data/modules.ts](src/data/modules.ts): add `isComms?: boolean` to `ModuleDef`, a new fitted module (e.g. high/med-slot "Comms Array", purchasable), and a `MODULE_FLAGS.isComms` predicate. Add `hasCommsEquipment(): boolean` (scan fitted slots like the existing fitting checks) — colocate with player stats/fitting helpers ([src/player/player-fitting.ts](src/player/player-fitting.ts) or [src/player/player-stats.ts](src/player/player-stats.ts)).

[src/ui/hud/enemy-menu.ts](src/ui/hud/enemy-menu.ts): look up the clicked entity's faction via `sys._enemyMap`. For a neutral, hailable ship when `hasCommsEquipment()`, add a **Hail** context-menu item; on click set `e._speech = { text: randomHailLine(), until: performance.now() + 4000 }`. Left-click locking already works (ambient ships are in `sys.enemies`, so [src/input.ts](src/input.ts) picks them up unchanged).

### Overview

[src/ui/bridge.ts](src/ui/bridge.ts): add `"neutral"` to `OverviewRow.kind`; in `buildLocalOverviewRows()` emit neutral rows (distinct icon + class label like `NEUT`) instead of `hostile` when `e.faction === "neutral"`. [src/ui/hud/overview.ts](src/ui/hud/overview.ts) + the relevant HUD CSS: add a green color rule for the neutral kind.

### Config / tuning

`src/config/enemies.ts` (or a new `src/config/ambient.ts` folded into `C`): ambient tunables — max transiting/active counts, spawn cadence range, transit/dwell durations, mine duration, hailable probability, engagement range for ambient combat ships, transit speed multiplier.

## Files

- New: `src/physics/ambient-ships.ts`, `src/data/faction-comms.ts`, `src/combat/factions.ts` (+ optional `src/config/ambient.ts`).
- Edit: `src/types/world.ts`, `src/data/enemies.ts`, `src/data/modules.ts`, `src/physics/npc-ai.ts`, `src/physics/npcs.ts`, `src/physics.ts`, `src/combat.ts`, `src/render/pixi-entities.ts`, `src/ui/hud/enemy-menu.ts`, `src/ui/bridge.ts`, `src/ui/hud/overview.ts`, `src/config/enemies.ts`, a player helper file for `hasCommsEquipment()`, and the relevant HUD CSS.

## Reused functions

- `buildEnemyFitting()` / pattern of `buildEnemyFromSpawn()` — [src/utils/spawn.ts](src/utils/spawn.ts)
- `getEnemyTexture()` / `bakeEnemyTexture()` / `syncPixiEntities()` — [src/render/pixi-entities.ts](src/render/pixi-entities.ts)
- `damageEnemy()` / `killEnemy()` — [src/combat.ts](src/combat.ts)
- `liveEnemies()` / `liveAsteroids()` — [src/utils/game.ts](src/utils/game.ts)
- `angleDiff()` — [src/utils/math.js](src/utils/math.ts); `addEnemyBullet`/`addBeam` — [src/utils/entities.ts](src/utils/entities.ts)
- Spatial grid `query()` — [src/utils/spatial.ts](src/utils/spatial.ts)
- `worldText()`/`floatText()` — [src/render/world-text.ts](src/render/world-text.ts) / [src/utils/fx.ts](src/utils/fx.ts)

## Verification

1. `npm run typecheck` and `npm run build` pass; `npm run test:run` stays green.
2. `npm run dev`, load the starter system, and observe over a few minutes:
   - Neutral (teal/green) ships warp in at a gate, travel to the station / asteroids, do their activity, then head to a gate and despawn — never more than ~2 transiting + ~2 active at once.
   - A neutral combat ship and a hostile rat/drone exchange fire; one can destroy the other (hostiles target neutrals and vice versa). Confirm killing a neutral grants **no** player XP/bounty.
   - Neutral ships appear in the overview in green and can be left-click locked.
3. Comms gating: with **no** comms module fitted, no exclamation marks appear and the right-click menu has no Hail. Fit the Comms Array (buy it in the station market), then a hailable ship shows a `!`; right-click → Hail pops a space-joke speech bubble above it for a few seconds.
