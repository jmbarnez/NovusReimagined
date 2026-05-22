# Novus — Systems Review: Underdeveloped & Partial Functionality

## Context

You asked for a review of the current game to surface what's left underdeveloped,
partially implemented, or rough. This is a **findings report only** — an assessment,
not a proposal to change code. Findings are organized by the three areas you flagged
as most important: **broken/dead stubs**, **half-built systems**, and
**balance/hardcoded values**. Thin content/data (ship/enemy/recipe counts) is noted
briefly at the end since you deprioritized it.

Findings were gathered via codebase exploration; the highest-impact items were
re-read and verified directly (citations below are confirmed unless marked *(reported,
unverified)*).

---

## 1. Broken / Dead Stubs

Functions that are wired into the app but do nothing. These are the most concrete
"looks done, isn't" gaps.

| # | Location | What it is | Why it's a problem |
|---|----------|-----------|--------------------|
| 1.1 | [src/ui/station/fitting.ts:3](src/ui/station/fitting.ts#L3) | `export function renderFitting() {}` — entire body empty | Imported/exported through [src/ui/station.ts](src/ui/station.ts) but never produces a Fitting panel. All fitting is funneled through the Hangar tab. The Fitting tab is dead. **Verified.** |
| 1.2 | [src/dock.ts:69-95](src/dock.ts#L69-L95) | `closeBridge`, `openBridge`, `toggleBridge`, `toggleBridgeInventory`, `toggleBridgeOverview`, `toggleSkills`, `closeSkills`, `renderBridgeUI` — all empty no-ops | Legacy from a removed floating-window bridge UI. Either still referenced (callers silently do nothing) or fully dead code that should be deleted. **Verified.** |
| 1.3 | [src/ui/inventory.ts:216-220](src/ui/inventory.ts#L216-L220) | `getItemsForContainer()` returns `[]` for both `"ship"` and `"station"` containers | Ship-level and station-level inventory containers render empty regardless of contents. Persistent storage at these scopes is not implemented. **Verified.** |
| 1.4 | [src/state-access.ts:214-219](src/state-access.ts#L214-L219) | `setCombatHeat()` is an explicit no-op (`void value`) | The accessor exists "for domain clarity" but discards its argument. See half-built combat-heat system (2.5). **Verified.** |

---

## 2. Half-Built Systems

Mechanics that partially exist — present in data/types/UI but not fully wired or
without gameplay consequence.

- **2.1 Missiles** — `tu-missile` / `hi-cruise` exist as a `WeaponDelivery` type, but
  there's no homing/guidance; missiles fall through to standard projectile code in
  [src/combat.ts](src/combat.ts). The cruise launcher
  ([src/data/modules.ts](src/data/modules.ts)) is explicitly named "(offline)" and
  reserves a high slot while doing nothing. *(reported, unverified — confirm exact lines)*

- **2.2 Combat heat** — `Client.combatHeat` is incremented on damage and decays over
  time, but nothing reads it for any rule (no accuracy/recoil/overheat). It's a
  display-only metric. Pairs with the no-op accessor in 1.4. *(reported, unverified)*

- **2.3 Ambient traffic locked to starter system** — the ambient/traffic director only
  runs when `sysIdx === 0` ([src/physics.ts](src/physics.ts) ~L26-28). Systems 1+ have
  no haulers/miners/escorts/scouts — they feel dead. *(reported, unverified)*

- **2.4 Enemy shield regen** — enemy shields take damage but never regenerate; only the
  player's shield regenerates ([src/physics/ship.ts](src/physics/ship.ts) ~L243).
  Sustained fights have no enemy-recovery dynamic. *(reported, unverified)*

- **2.5 Enemy structure layer** — enemies can carry a `maxStructure` overflow tier
  ([src/combat.ts](src/combat.ts) ~L315), but it only acts as a hidden second health
  bar with no distinct gameplay; most enemies don't define it. *(reported, unverified)*

- **2.6 Player abilities** — only 2 abilities exist (Warp Burst / blink, Emergency
  Shield / bulwark) in [src/player/abilities.ts](src/player/abilities.ts); both
  defensive/mobility. The framework supports more but is unpopulated. *(reported)*

- **2.7 Engagement AI archetypes** — 4 profiles (orbiter, skirmisher, brawler, sentry)
  in [src/config/enemies.ts](src/config/enemies.ts); higher-tier enemies (raider/pirate)
  collapse to "brawler" with no tactical differentiation. *(reported, unverified)*

- **2.8 Processing hub** — `HubJob`/`HubOutput` types exist in
  [src/state.ts](src/state.ts) with minimal UI but no real processing mechanics, job
  queue, or integration with the crafting loop. *(reported, unverified)*

- **2.9 Pixi/Canvas2D render split** — station rendering is mid-refactor: safe-zone
  ring, dock ring, and labels remain in Canvas2D "for now"
  ([src/render/pixi-stations.ts](src/render/pixi-stations.ts) ~L13). Trail particles are
  described as "minimal" placeholders ([src/render/pixi-particles.ts](src/render/pixi-particles.ts)). *(reported, unverified)*

---

## 3. Balance / Hardcoded Values

Magic numbers and placeholder tuning that bypass the config layer — fine for a
prototype, but they make balancing and progression-scaling hard. All *(reported,
unverified)* — worth a focused pass to confirm and migrate into `src/config`.

- **3.1 Station turrets** — `STATION_TURRET_*` (range/damage/reload/align) are inline
  constants in [src/physics/station-turrets.ts](src/physics/station-turrets.ts) with no
  config override; aim uses raw `(Math.random()-Math.random())*0.06` jitter and no
  predictive aiming (unlike NPC turrets).
- **3.2 Salvager** — `SALVAGE_DPS = 4` hardcoded ([src/salvager.ts](src/salvager.ts));
  only affix `rollBonus` scales it. No skill/stat scaling (mining scales via
  `miningMult`, salvage does not).
- **3.3 Mining beam** — energy cost hardcoded `10 * dt`, range and "hum" interval (0.5s)
  inline in [src/physics/npcs.ts](src/physics/npcs.ts); no module-tier or skill scaling.
- **3.4 Asteroid respawn** — respawn timer (~60±60s), positional jitter (±80px), and
  re-rolled ore weights are all inline in
  [src/physics/npcs.ts](src/physics/npcs.ts) ~L294-341; no scarcity/zone tuning.
- **3.5 NPC aim prediction** — intercept time hard-capped at 2.0s in
  [src/physics/npc-ai.ts](src/physics/npc-ai.ts); lock-on uses magic constants
  (baseTime 6.0s, reduction 1.5) with no per-faction/tier variance.
- **3.6 Wreck loot** — fixed probabilities and `intactPart*` constants in
  [src/wreck.ts](src/wreck.ts); no scaling by zone/tier/fitted modules.

---

## 4. Content Sparsity (deprioritized — noted for completeness)

Not a focus per your direction, but the loop is thin on variety: ~3 ships, ~11 enemy
types (4 of them non-combat faction NPCs with empty loot), ~11 crafting recipes,
~13 affixes, 2 abilities, 8 skills with flat linear XP. The systems exist; the tables
are small.

---

## Top of the list (if/when you act on this)

Purely an ordering suggestion — no work is being proposed here:

1. **Fitting tab stub (1.1)** — most visible "feature that does nothing."
2. **Dead bridge stubs (1.2)** — decide delete vs. implement; reduces confusion.
3. **Combat heat (1.4 + 2.5/2.2)** — either give it a rule or remove the plumbing.
4. **Config migration of hardcoded balance (Section 3)** — unblocks tuning/progression.

## Verification of this report

These findings were derived from read-only exploration. The four items marked
**Verified** (1.1–1.4) were confirmed by direct file reads. To verify the
*(reported, unverified)* items, grep the cited files for the symbols named
(e.g. `combatHeat`, `sysIdx === 0`, `SALVAGE_DPS`, `maxStructure`, `tu-missile`) and
confirm the line context before relying on them.
