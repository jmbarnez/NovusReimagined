# SHIP Panel — Cargo + Stats tabs with full ship stats & per-turret info

## Context
The Tab key currently opens a single-view floating HUD window titled **"Cargo Hold"** (cargo inventory only). We want to turn it into a multi-tab **SHIP** panel so the player can inspect their ship in detail without docking:
- **Cargo** tab — the existing inventory view, unchanged.
- **Stats** tab — every ship stat we can compute (defense/health, capacitor, propulsion, sensors, fitting, offense), organized into labeled sections, with current/max where it applies. The user explicitly wants maximal coverage ("show every stat we can provide; we can leave some out in the future").
- A **Turrets section** at the bottom of the Stats tab showing one card per fitted turret slot (type, damage profile, range, tracking, rate of fire, cap/ammo, durability) plus live state (power, cooldown, heat, target).

Today this detail only exists in the docked station fitting screen and in transient slot tooltips. This brings it into the in-flight HUD.

## Decisions (confirmed)
- **Two tabs: `Cargo | Stats`.** Turret info is a section inside the Stats tab (not a separate tab).
- **Keep the internal window id `"cargo"`**, only change the visible title to **"SHIP"**. This preserves the `eve-window-cargo` CSS class mapping ([windows.ts:33](src/ui/hud/windows.ts#L33)) and the window's default size/position ([bridge.css:7](src/ui/styles/bridge.css#L7)), and avoids touching every `isOpen("cargo")`/`closeHudWindow` caller.
- **Live updates** for volatile values (current hp/structure/shield/energy, and per-turret cooldown/heat/target/power) via the existing per-frame `updateHudOverlay()` loop, using dirty-checks (no full innerHTML rebuild each frame).

## Files
1. **ADD [src/ui/hud/ship-panel.ts](src/ui/hud/ship-panel.ts)** — owns the tab shell, the Stats renderer (sections + turret cards), and the live-update logic. Delegates the Cargo tab to the existing inventory functions.
2. **ADD [src/ui/styles/ship-panel.css](src/ui/styles/ship-panel.css)** — tab strip + scoped stat-card + section header + turret-card styles. Imported at the top of `ship-panel.ts`.
3. **EDIT [src/ui/hud-overlay.ts](src/ui/hud-overlay.ts)** — rewrite `toggleCargoWindow()` to build the tab shell; add an `updateShipPanelLive()` call inside `updateHudOverlay()` near the existing `#inv-credits-value` block (~line 252).
4. **No change** to `inventory.ts`, `windows.ts`, `input.ts`, `player-stats.ts`, `slotTooltip.ts`, `slots.ts`, `bridge.css`, `station/hangar.ts` — all reused via their existing exports.

## Reused building blocks (do not reinvent)
- Stats source: `getStats(): ComputedStats` ([player-stats.ts:55](src/player/player-stats.ts#L55)); per-slot weapon profile `getWeaponProfileForSlot(idx)` ([player-stats.ts:274](src/player/player-stats.ts#L274)).
- Ship def: `SHIPS[G.P.shipId]` ([ships.ts](src/data/ships.ts)) — resistances, signature, slot counts, ranges, mass, cargo m³.
- Live values: `G.P` ([state.ts](src/state.ts)) — `hp`, `structure`, `shield`, `energy`, `turretPower[]`, `turretCds[]`, `turretTargets[]`, `turretPowerCd[]`, `slotHeat`, `fireControlSlot`.
- Targeting helpers: `maxTargetLocks()`, `getLockAcquireRangePx(ship)`, `getSensorContactRangePx(ship)`, `targetByLockId(id)` ([targeting.ts](src/targeting.ts)).
- Turret data: `MODULES`, `MODULE_FLAGS` ([modules.ts](src/data/modules.ts)); `WEAPON_PROFILES` ([weaponProfiles.ts](src/data/weaponProfiles.ts)); `RARITY_CONFIG` ([moduleRarity.ts](src/data/moduleRarity.ts)); `getInstance` ([utils/items.ts](src/utils/items.ts)); `MODULE_HP_MAX`, `TURRET_POWER_CYCLE_S` ([constants.ts](src/constants.ts)).
- Tab UI pattern: [settings.ts:208-218](src/ui/settings.ts#L208-L218) (`.settings-tab[data-tab]` + `.tab-panel[data-tab-panel]`, toggle `.active`); CSS [settings.css:20-26](src/ui/styles/settings.css#L20-L26).
- Stat-card markup/CSS to mirror: `.st-stat-card/.lbl/.val/.delta` from [station-fitting.css:9-56](src/ui/styles/station-fitting.css#L9-L56) (HUD does **not** import this file — see gotchas).
- Per-turret formatting reference: `damageTypeLabel`, delivery-label map, projectile-speed/tracking/durability formatting in [slotTooltip.ts:38-148](src/ui/hud/slotTooltip.ts#L38-L148); live turret-state logic in `updateSlotNode` [slots.ts:178-308](src/ui/hud/slots.ts#L178-L308).

## DOM structure (shell built by `toggleCargoWindow`)
```
<div id="ship-panel-root" class="sp-root">         (flex column, 100% h/w, overflow hidden)
  <div class="sp-tabs">
    <button class="sp-tab active" data-tab="cargo">Cargo</button>
    <button class="sp-tab"        data-tab="stats">Stats</button>
  </div>
  <div class="sp-body">                            (flex:1; min-height:0; position:relative)
    <div class="sp-tab-panel active" data-tab-panel="cargo">
      <div id="bridge-pane-cargo" class="br-pane"  (KEEP this exact id — inventory.ts depends on it)
           style="height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;">
        {{ renderInventoryHTML() }}
      </div>
    </div>
    <div class="sp-tab-panel" data-tab-panel="stats">
      <div class="sp-scroll" id="ship-stats-scroll">{{ renderStatsTabHTML() }}</div>
    </div>
  </div>
</div>
```
Tab switching mirrors [settings.ts:209-218](src/ui/settings.ts#L209-L218), scoped to `#ship-panel-root`; `sfxBlip()` on click; module-level `activeShipTab: "cargo"|"stats" = "cargo"`. On switch to Stats, (re)build the stats panel and cache turret-card refs.

## `ship-panel.ts` functions
- `buildShipPanelShell(): HTMLElement` — builds the shell above; Cargo panel innerHTML = `renderInventoryHTML()`; Stats panel filled by `renderStatsTabHTML()`.
- `attachShipPanelListeners(root)` — wires `.sp-tab` clicks (toggle active + `sfxBlip`). Call `attachInventoryListeners()` **once at open**, not per tab switch (switching tabs never rebuilds the inventory DOM, so its listeners survive). On switch to Stats, rebuild stats HTML and re-cache turret refs.
- `renderStatsTabHTML(): string` — the grouped sections + turrets section (below). Local `statCard(label, value, unit?)` helper emitting `.st-stat-card`/`.lbl`/`.val` markup so the scoped CSS applies. Use a local helper rather than `buildStatHtml` because many values come from `ship`/`G.P`/targeting helpers and we need live *current* values (which `buildStatHtml` doesn't read).
- `updateShipPanelLive()` — exported; called every frame from `updateHudOverlay`. Cheap guard: `if (!isOpen("cargo") || activeShipTab !== "stats") return;`. Dirty-checks (a) the live stat `.val` cells (give them stable ids: `sp-cur-hp`, `sp-cur-struct`, `sp-cur-shield`, `sp-cur-energy`) and (b) each cached turret card's volatile fields.
- Turret-card helpers: `renderTurretCard(idx)` (static markup) + a `turretCardNodes: Map<number, {...refs}>` cached on stats-build, updated by `updateShipPanelLive`. Port live logic from `updateSlotNode`. Copy the module-private `damageTypeLabel` + delivery-label map from slotTooltip.ts (don't export from there).

## Stats tab content (grouped sections — every available stat)
`st = getStats()`, `ship = st.ship`, `p = G.P`. Each section: `<div class="sp-sect"><div class="sp-sect-h">TITLE</div><div class="sp-stats-grid">…cards…</div></div>`.

- **Ship**: Name `ship.name`; Role `ship.role`; Signature Radius `ship.signatureRadius` m; Mass `ship.hullMassKg` kg; Mass Mult `st.massMult`×.
- **Defense**: Hull `p.hp`/`st.maxHp` *(live)*; Armor/Structure `p.structure`/`st.maxStructure` *(live)*; Shield `p.shield`/`st.maxShield` *(live)*; Shield Regen `st.shieldRegen`/s; Resist EM/Thermal/Kinetic/Explosive `ship.resistances.{em,therm,kin,exp}` (×100 %).
- **Capacitor**: Capacitor `p.energy`/`st.maxEnergy` *(live)*; Recharge `st.energyRegen` GJ/s.
- **Propulsion**: Max Speed `st.maxSpeed` px/s (base `st.baseMaxSpeed`); Main/Retro/Lateral Thrust `st.mainThrust`/`st.retroThrust`/`st.lateralThrust`; Turn Rate `st.turnRate` rad/s (base `st.baseTurnRate`); Agility `st.thrustScale`× (base `st.baseThrustScale`); Drag/s `st.dragPerSec`.
- **Sensors / Targeting**: Max Locked Targets `maxTargetLocks()`; Lock Range `ship.lockRangeKm` km; Sensor Range `ship.sensorContactRangeKm` km; Lock Scan `st.lockScanMult`×.
- **Fitting**: Powergrid `st.usedPG`/`st.totalPG` (overload warn if used>total); CPU `st.usedCPU`/`st.totalCPU`; Turret/High/Med/Low slots `ship.fitting.*`; Cargo Capacity `ship.baseCargoM3` m³.
- **Offense / Mining**: Primary Weapon `st.weaponTurret?.name ?? "—"`; Weapon Dmg `st.finalDmg`; Weapon Mult `st.weaponMult`×; Optimal Range `st.wProf.range` px; Rate of Fire `st.wProf.rate` s; Cap/Shot `st.wProf.ec` GJ; Ammo `st.wProf.ammoType` (`st.wProf.ammoPerShot`/shot); Has Miner `st.hasMiner`; Mining Mult `st.miningMult`×; Mine Range `ship.miningRangeKm` km; Has Salvager `st.hasSalvager`; Salvage Bonus `st.salvageBonus` %; Metallurgy Lv `st.metallurgyLevel`.

This covers every field of `ComputedStats` plus ship-def fields the player can't otherwise see.

## Turrets section (bottom of Stats tab)
For each `idx` in `0..ship.fitting.turret-1`: `uid = G.P.fitting.turret[idx]`; `inst = uid ? getInstance(uid) : null`; `m = inst ? MODULES[inst.baseId] : null`. Empty → `[ EMPTY TURRET n ]` placeholder. Fitted → `.sp-turret-card`:
- **Static**: title = rarity (color from `RARITY_CONFIG`) + `m.name`, slot label `T{idx+1}`; Type (delivery-label map); Damage profile (`damageTypeLabel(m.damageProfile)`); Optimal Range `m.optimalRange` km + Falloff `m.falloff`; Tracking `m.trackingSpeed*100`%; Projectile Speed `m.projectileKmPerTick*60` km/s; Rate of Fire `prof.rate` s where `prof = getWeaponProfileForSlot(idx) ?? WEAPON_PROFILES[inst.baseId] ?? WEAPON_PROFILES.default`; Cap/Shot `prof.ec`; Ammo `prof.ammoType`+`prof.ammoPerShot` (rounds left `G.P.ammo[prof.ammoType]`); PG/CPU/Mass `m.powergrid`/`m.cpu`/`m.massKg`; Durability bar `inst.durability/inst.maxDurability`.
- **Mining/salvage branch**: if `MODULE_FLAGS.isMiningTurret(m)` or `m.mining`/`m.isSalvager`, drop RoF/ammo; show mining range/yield or salvage bonus (mirror [slotTooltip.ts:84-106](src/ui/hud/slotTooltip.ts#L84-L106)).
- **Live (cached refs, updated per frame)**: Power pill ONLINE/OFFLINE (`G.P.turretPower[idx]`); power-cycle "PWR UP…/DN…" (`G.P.turretPowerCd[idx]`, `TURRET_POWER_CYCLE_S`); cooldown "RDY"/"{pct}%" + fill (`G.P.turretCds[idx]` vs `prof.rate`); heat bar + overheat>0.82 (`G.P.slotHeat?.turret[idx] ?? 0`); target name (`targetByLockId(G.P.turretTargets[idx])?.name`); selected highlight (`idx === G.P.fireControlSlot`); damaged/offline by durability. Same dirty-check discipline as `updateSlotNode` (write only when the value changed).

## `ship-panel.css`
- Tab strip: `.sp-tabs`, `.sp-tab`, `.sp-tab.active` (copied/renamed from settings.css:20-26). Panels: `.sp-tab-panel{display:none;height:100%} .sp-tab-panel.active{display:block}`. `.sp-scroll{height:100%;overflow-y:auto;padding:10px}` with thin scrollbar like `.ov-wrap`.
- Section headers: `.sp-sect`, `.sp-sect-h`.
- Stat grid scoped: `.sp-stats-grid` + `.sp-stats-grid .st-stat-card/.lbl/.val/.delta` (re-declared from station-fitting.css so the shared markup is styled in the HUD **without** importing station CSS, and scoped to avoid collision with bridge rows that also use `.lbl/.val`).
- Turret cards: `.sp-turret-card`, state pill, cooldown/heat/durability bars. Use only `var(--hud-*)` tokens so themes/fonts apply.

## Gotchas (verified against code)
- **Keep `#bridge-pane-cargo` exactly**: `rerenderInventory()` ([inventory.ts:288](src/ui/inventory.ts#L288)) and `attachInventoryListeners()` both query that id. Inventory only ever rewrites that div, so tab switching never collides — but the id must remain the Cargo tab's inner container.
- **Attach inventory listeners once at open**, not per tab switch.
- **CSS import is load-bearing**: `.st-stat-card/.lbl/.val/.delta` exist only in station-fitting.css, which the HUD never imports. Without `ship-panel.css` (re)declaring them scoped under `.sp-stats-grid`, the Stats tab renders unstyled. Do not define bare global `.lbl/.val`.
- **Window body is `display:flex;flex-direction:column;overflow:hidden`** (bridge.css:19) — shell root must be `height:100%`; scrolling lives on inner `.sp-scroll`.
- **Optional/indexed state**: guard `G.P.slotHeat?.turret?.[idx] ?? 0`, `turretCds?.[idx] ?? 0`, etc.
- **`getWeaponProfileForSlot(idx)` returns null** for empty/mining slots — fall back to `WEAPON_PROFILES[inst.baseId] || WEAPON_PROFILES.default` and use the mining/salvage branch.
- **Range helpers**: `maxTargetLocks()` reads `G.P.shipId` internally; `getLockAcquireRangePx`/`getSensorContactRangePx` take a `ShipDef` — pass `st.ship`.
- **Title vs id**: only the visible title becomes "SHIP"; the id passed to `toggleHudWindow`/`isOpen`/`closeHudWindow` stays `"cargo"`.

## Verification
1. Build/type-check (`npm run build` or the project's tsc/vite check) — no TS errors.
2. Run the game (`/run` skill or `npm run dev`). Press **Tab**: window opens titled **SHIP**, defaulting to the **Cargo** tab; confirm inventory still works (filter, sort, jettison, context menu, capacity bar, credits).
3. Click **Stats**: confirm all sections render with values; take damage / burn capacitor and verify Hull/Structure/Shield/Capacitor current values update live; change fitting at a station and reopen to confirm maxes/PG/CPU update.
4. Scroll to the **Turrets** section: confirm each fitted turret shows full static stats; fire weapons and toggle power (right-click slot) and verify cooldown %, heat bar, target name, and ONLINE/OFFLINE pill update live; empty slots show the placeholder; a mining/salvage turret shows the mining/salvage branch.
5. Switch theme/font in Settings: confirm the SHIP panel restyles (tokens applied).
6. Press **Tab** again to close; reopen and confirm it remembers no broken state.
