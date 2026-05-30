# Turret Combat Upgrade — Optimal/Falloff, Tracking, Damage Types & Resists

## Context

Lasers (and turrets generally) currently *fire* correctly but don't *behave* like a
real weapon system. Three mechanics are advertised in the UI but inert in combat:

- **Optimal + falloff**: modules carry `optimalRange`/`falloff` (shown in tooltips) but
  combat applies **flat damage to a hard `range` cutoff** — no taper.
- **Tracking/transversal**: `computeHitChance`/`computeAimDeviation` consume
  `trackingSpeed`, transversal and signature, but the result is stored on
  `bullet.hitChance` and **never read**. A beam hits a fast orbiter as reliably as a
  stationary target.
- **Damage types** (`damageProfile` em/therm/kin/exp): cosmetic; enemies have no resists.

Goal (confirmed scope): implement all three, across **all player turrets** (beams +
projectiles), so the displayed stats become real and lasers gain range/tracking
identity. Missiles are guided and excluded from tracking (range already modeled by
flight + arming).

## Design

### 1. Optimal/falloff in px — `computeScaledWeaponProfile` ([player-stats.ts:264](src/player/player-stats.ts#L264))
Extend `WeaponProfile` ([weaponProfiles.ts:3](src/data/weaponProfiles.ts#L3)) with optional
`optimalPx?`, `falloffPx?`. Derive from the module's km optimal:falloff ratio anchored
to the existing px `range`, so reach is preserved and only the tail tapers:
```
const optKm = turretMod?.optimalRange ?? 0, fallKm = turretMod?.falloff ?? 0;
const edge = C.COMBAT.RANGE_MODEL.edgeFalloffs;   // 2.0
if (optKm + fallKm > 0) {
  const denom = optKm + edge * fallKm;
  wProf.optimalPx = Math.round(wProf.range * (optKm / denom));
  wProf.falloffPx = Math.max(1, Math.round(wProf.range * (fallKm / denom)));
} else { wProf.optimalPx = wProf.range; wProf.falloffPx = C.COMBAT.RANGE_MODEL.minFalloffPx; }
```
`range` is unchanged, so the auto-fire range gate ([combat.ts:128](src/combat.ts#L128)) and
projectile `life = range/spd` stay valid. Profileless/NPC/default → `optimalPx = range`
(behaves like today).

### 2. Unified hit-quality (range + tracking) → 0..1 — new helper in [combat.ts](src/combat.ts)
Canonical EVE form `0.5^(trackTerm² + rangeTerm²)`, reusing `transversalVs`
([targeting.ts:154](src/targeting.ts#L154)), `turretMod.trackingSpeed`, `target.sigRadius`:
```
rangeTerm = max(0,(dist - optimalPx)/max(1,falloffPx));
angular   = transversalVs(target)/dist;
trackTerm = (angular / max(floor,trk)) * (sigRef/sig) * K;
quality   = pow(0.5, trackTerm² + rangeTerm²);
```
- **Replace the `variance` term** ([combat.ts:260-261](src/combat.ts#L260)) with
  `quality * lerp(jitterMin,1,rand)` — continuous scaling (reads better than coin-flip
  misses at base damage 2–6); optional MISS float when `quality < missThreshold`.
- **Beam** (`fireBeamWeapon`): compute quality vs the locked `actualTarget` in
  `playerShoot`, pass it down, multiply mitigated damage by it.
- **Projectile**: **lock quality + mitigation in at fire time**, store the final number on
  `bullet.dmg` (bullet already carries `dmg`; avoids re-resolving transversal mid-flight).
- **Missile**: no tracking/range term; damage-type mitigation + existing arming mult only.
- Retire the dead path: `computeHitChance`/`bullet.hitChance` are unused — re-point or
  delete `computeHitChance` after confirming no importer; keep `computeAimDeviation*` (FX).

### 3. Damage types + resists — single choke point `damageEnemy` ([combat.ts:330](src/combat.ts#L330))
- `normalizeProfile(p?)` → fractions {em,therm,kin,exp} (handles the relative-split data,
  e.g. `tu-ion {em:6,therm:6}` → 0.5/0.5); empty → "no profile".
- Add `resists?: {em,therm,kin,exp}` to runtime `Enemy` ([types/world.ts:114](src/types/world.ts#L114)),
  populated at the two spawn sites — `buildEnemyFromSpawn` ([spawn.ts:62](src/utils/spawn.ts#L62))
  and ambient ([ambient-ships.ts:24](src/physics/ambient-ships.ts#L24)) — via `resolveEnemyResists(type)`.
- Extend `damageEnemy` with an **optional trailing `dmgProfile?`** param (6 call sites
  compile unchanged): `mitigated = applyResists(dmg, profile, e.resists)` then the existing
  shield→hull→structure logic runs on `mitigated`.
- Per call site: player beam ([combat.ts:220](src/combat.ts#L220)) passes
  `turretMod.damageProfile`; missile carries a normalized `Bullet.dmgProfile?` set in
  `fireMissile` ([combat-physics.ts:100](src/physics/combat-physics.ts#L100)); player projectile
  ([combat-physics.ts:200](src/physics/combat-physics.ts#L200)) is **pre-mitigated at fire time**
  (no profile passed → no double-dip); NPC-vs-NPC ([npcs.ts:278](src/physics/npcs.ts#L278),
  [npc-ai.ts:98](src/physics/npc-ai.ts#L98)) pass nothing → neutral/unmitigated.

### 4. Config — [config/combat.ts](src/config/combat.ts)
```
RANGE_MODEL: { edgeFalloffs: 2.0, minFalloffPx: 1, defaultSig: 30, sigRef: 40, jitterMin: 0.85, missThreshold: 0.08 },
TRACKING:    { k: 1.0, trackingFloor: 0.02 },
RESISTS:     { defaultPerType: 0.10, min: 0.0, max: 0.85 },
```
Primary balance levers: `sigRef`, `TRACKING.k`, `edgeFalloffs`. Tune `jitterMin` so
near-optimal mean DPS stays ≈ today (old variance mean ≈ 0.85×).

### 5. Enemy resist data — [enemies.ts](src/data/enemies.ts) (light)
Add optional `EnemyDef.resists?`, a shared default, and 2–3 archetypes:
```
RESIST_DEFAULT {em:.10,therm:.10,kin:.10,exp:.10}
RESIST_DRONE   {em:.30,therm:.25,kin:.10,exp:.05}
RESIST_ARMOR   {em:.05,therm:.15,kin:.25,exp:.35}
resolveEnemyResists(type) = ENEMY_DEFS[type].resists ?? archetype(type) ?? RESIST_DEFAULT
```
Map only a couple explicitly (`pirate`/`raider`→armor, `rat_drone`/`drone`→drone); give
`raider` a high-resist set for an unambiguous in-game test. Only `enemies.ts` + the two
spawn sites change.

### 6. UI
Tooltips already display module optimal/falloff/damage-type
([slotTooltip.ts:62](src/ui/hud/slotTooltip.ts#L62), [ship-panel.ts:387](src/ui/hud/ship-panel.ts#L387),
[station/shared.ts:48](src/ui/station/shared.ts#L48)) — consuming the same fields makes them
truthful for free. Keep km as the displayed unit. Optional: show target resists in the
HUD (mirror the player-resist readout at [ship-panel.ts:233](src/ui/hud/ship-panel.ts#L233)).

## Critical files
- [src/combat.ts](src/combat.ts) — hit-quality helper, fold into `playerShoot`/`fireBeamWeapon`, extend `damageEnemy`, retire `computeHitChance`.
- [src/player/player-stats.ts](src/player/player-stats.ts) — `optimalPx`/`falloffPx` derivation.
- [src/data/weaponProfiles.ts](src/data/weaponProfiles.ts) — `WeaponProfile` fields.
- [src/types/world.ts](src/types/world.ts) + [src/utils/spawn.ts](src/utils/spawn.ts) + [src/physics/ambient-ships.ts](src/physics/ambient-ships.ts) — `Enemy.resists`.
- [src/data/enemies.ts](src/data/enemies.ts) — resist defs + `resolveEnemyResists`.
- [src/config/combat.ts](src/config/combat.ts) — config block.
- [src/physics/combat-physics.ts](src/physics/combat-physics.ts) + [src/utils/entities.ts](src/utils/entities.ts) — `Bullet.dmgProfile` for missiles.

## Risks
- **Rebalancing**: low-tracking guns (`tu-gauss` trk 0.14) get materially worse vs orbiters;
  removing flat `variance` shifts average DPS even at optimal. Tune the levers in §4.
- **Player-incoming asymmetry**: `ShipDef.resistances` exists but `damagePlayer`
  ([damage-display.ts:82](src/combat/damage-display.ts#L82)) ignores it, and NPC weapons have no
  `damageProfile`. v1 keeps enemy→player unchanged; symmetric player mitigation is a
  documented follow-up (needs NPC damage profiles).
- **Stray projectile hits**: fire-time mitigation uses the lock target's resists; a bullet
  that hits a *different* enemy uses the wrong set. Acceptable v1; carrying
  `Bullet.dmgProfile` and mitigating on impact is the more-correct alternative.
- **Affix dead-path**: `optimalRange`/`falloff` affixes write to copied effects in
  `computeStats` but `computeScaledWeaponProfile` reads the raw module def — affixed
  optimal/falloff won't reach combat unless threaded through. Decide explicitly (v1 may
  leave affixes cosmetic).

## Verification
- `npx tsc --noEmit`; `npm run test:run` (first grep tests for `damageEnemy`/`variance`/
  `WeaponProfile` and update flat-damage assertions). Add unit tests for `applyResists`
  (mitigation/clamp/no-profile), `computeHitQuality` (=1 at optimal & zero transversal;
  decreases past optimal and with transversal; bigger sig → higher), and
  `computeScaledWeaponProfile` (`optimalPx < range`; `optimalPx + edge*falloffPx ≈ range`;
  profileless → `optimalPx == range`).
- `npm run dev`: taper (near vs far stationary, beam vs projectile); tracking (fast orbiter
  vs stationary, esp. `tu-gauss`; big-sig easier); resists (kinetic `tu-cannon` vs
  kinetic-resist `raider`, then EM/therm `tu-ion` vs same — should land harder); regression
  (enemy-vs-enemy and NPC→player unchanged, missiles still arm/detonate, mining unaffected).
