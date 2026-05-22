# Enemy Right-Click Context Menu — Strategic Positioning

## Context

Today the player can only interact with an enemy by **left-clicking** it to request a
sensor lock ([input.ts:159-166](src/input.ts#L159-L166)). **Right-click** anywhere in the
world simply drops a movement waypoint ([input.ts:197-203](src/input.ts#L197-L203)), and the
ship's only autopilot is the "fly to waypoint" logic in
[ship.ts:45-66](src/physics/ship.ts#L45-L66). There are **no orbit / keep-at-range style
maneuver commands** for the player, even though the enemy AI already implements orbiting
([npc-ai.ts:94-109](src/physics/npc-ai.ts#L94-L109)).

This change adds an EVE-style right-click context menu on enemies offering **Orbit**,
**Keep at Range** (each with a distance-preset submenu), and targeting actions
(**Lock / Unlock**). Selecting a maneuver engages a new entity-tracking autopilot so the
player can fight from a managed position instead of flying manually.

## Decisions (from user)
- Commands: **Orbit** and **Keep at Range** (Approach/Stop not needed — both maneuvers fly
  toward a distant target on their own; a fresh waypoint or "Stop" entry cancels them).
- Distance: **preset submenu** per command (e.g. 5 km / 10 km / 20 km / 30 km).
- Also include **targeting actions** (Lock Target / Unlock) in the same menu.

---

## Design overview

Two halves:

1. **A new player navigation command** (`Client.navCommand`) consumed by the ship physics —
   an entity-tracking autopilot for orbit / keep-at-range, mirroring the NPC orbit math.
2. **A DOM context menu** opened on right-clicking an enemy in the world, mirroring the
   existing turret menu pattern, that issues those commands.

### 1. Navigation command state + physics

**`src/state.ts`** — add to the `Client` interface (near `waypoint`, line 167) and its
initializer (line 219):
```ts
navCommand: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
```
Initialize to `null`. The existing `waypoint` stays for empty-space right-clicks.

**`src/physics/ship.ts`** — in `updateShip`, before the current waypoint block
(line 45), add a `navCommand` branch that takes priority when set:
- Resolve the target via `enemyByLockId(navCommand.targetId)` (from
  [targeting.ts:82-87](src/targeting.ts#L82-L87)). If it returns `null` (enemy dead/gone),
  clear `navCommand` and fall through.
- Compute `d = dist(player, target)` and `targetAngle = atan2(...)`.
- **orbit**: reuse the three-zone logic from
  [npc-ai.ts:94-109](src/physics/npc-ai.ts#L94-L109) — if `d > range + hysteresis` steer
  toward target; if `d < range - hysteresis` steer away (`+PI`); else steer tangentially
  (`+PI/2 * dir`). Drive `ax/ay` and `at` the same way the waypoint block sets them so the
  shared `mainThrust`/`turnRate` integration below (line 123) applies, and set
  `thrustFx = true`.
- **keepRange**: steer toward target and thrust when `d > range + hysteresis`; steer away
  and thrust when `d < range - hysteresis`; otherwise coast (no thrust, hold heading toward
  target so weapons stay on it).
- Keep the existing waypoint and mouse-aim branches as the `else` cases.

Setting a waypoint (empty-space right-click) or choosing "Stop" must clear `navCommand`;
issuing a maneuver clears `waypoint`. Centralize this in a small helper, e.g.
`setNavCommand(cmd)` / `clearNav()` in **`src/state-access.ts`** (where other `Client`
mutations live) so input and the menu both use it.

Distance presets use the world's px-per-km scale (`baseRangePx / referenceKm` =
620 / 72 ≈ 8.6 px/km, from [config/targeting.ts:3-4](src/config/targeting.ts#L3-L4)). Add a
small `kmToPx(km)` helper rather than hardcoding pixel values. Orbit hysteresis can reuse a
modest constant (NPC uses ~tens of px); expose it in `C` if a config home fits, otherwise a
local const in ship.ts.

### 2. Enemy context menu (DOM)

Mirror the turret menu trio in a new file **`src/ui/hud/enemy-menu.ts`**:
`showEnemyCtxMenu(x, y, enemyId)`, `hideEnemyCtxMenu()`, `onEnemyCtxItemClick(e)` — modeled
directly on [turret-menu.ts](src/ui/hud/turret-menu.ts) (dynamic `innerHTML`, viewport
clamping at lines 38-41, per-item click listeners, hide after action).

Menu contents (use `data-action` / `data-range` attributes like the turret menu's
`data-action`/`data-idx`):
- `Orbit` ▸ submenu: `5 km`, `10 km`, `20 km`, `30 km`
- `Keep at Range` ▸ submenu: `5 km`, `10 km`, `20 km`, `30 km`
- separator (`.ctx-sep`)
- `Lock Target` (or `Unlock Target` when already locked — check `G.P.lockQueue` /
  `G.P.targetLock` as the turret menu checks power state)
- `Stop` (clears `navCommand`)

Submenus: simplest is a flyout on hover (nested `.ctx-submenu` div shown on `.ctx-item`
hover) — keep CSS-driven like the existing hover states. If a flyout proves fiddly, fall
back to flattened items (`Orbit 10 km`, …); the action handler is identical either way.

**State + creation** — add `enemyCtxMenu` to `hudState`
([state.ts:19](src/ui/hud/state.ts#L19) area) and create the `<div id="enemy-ctx-menu">`
in **`src/ui/hud-overlay.ts`** alongside the turret menu (it's created ~lines 157-167 and
dismissed by the outside-click listener ~lines 162-164 — extend that listener to also hide
the enemy menu).

**Styles** — add **`src/ui/styles/hud-enemy-menu.css`** cloned from
[hud-turret-menu.css](src/ui/styles/hud-turret-menu.css) (reuse `.ctx-item`, `.ctx-sep`,
`.disabled`, design tokens), plus a `.ctx-submenu` flyout and a `▸` affordance. Import it at
the top of `enemy-menu.ts` (same as turret menu line 1).

### 3. Wiring right-click → menu

**`src/input.ts`** — in the RMB `mousedown` handler (line 197), before setting a waypoint,
hit-test enemies exactly as the LMB handler does
([input.ts:159-166](src/input.ts#L159-L166), `dst(wx,wy,en.x,en.y) < 30`):
- **Enemy under cursor** → `showEnemyCtxMenu(e.clientX, e.clientY, en.id)` and **do not**
  set a waypoint (and don't set `Client.mouse.rmb`, so the `mousemove` drag at lines 212-214
  won't start dragging a waypoint).
- **Empty space** → existing behavior: set waypoint **and clear `navCommand`**.

The global `contextmenu` preventDefault ([input.ts:224-227](src/input.ts#L224-L227)) already
suppresses the native menu in the world, so no change needed there.

### 4. (Optional, low-cost) Overview panel parity

The overview rows ([overview.ts](src/ui/hud/overview.ts)) are plain `<tr data-id>` elements
with no right-click handler. Adding a `contextmenu` listener that calls
`showEnemyCtxMenu(e.clientX, e.clientY, row.dataset.id)` gives the same menu from the list.
Include only if straightforward; otherwise note as a follow-up.

---

## Files to touch
- [src/state.ts](src/state.ts) — `navCommand` field + initializer.
- [src/state-access.ts](src/state-access.ts) — `setNavCommand` / `clearNav` helpers; clear waypoint↔nav mutually.
- [src/physics/ship.ts](src/physics/ship.ts) — `navCommand` autopilot branch (orbit / keep-range), reusing npc-ai orbit math; `kmToPx` helper.
- **new** `src/ui/hud/enemy-menu.ts` — show/hide/click, modeled on turret-menu.ts.
- **new** `src/ui/styles/hud-enemy-menu.css` — cloned from hud-turret-menu.css + submenu.
- [src/ui/hud/state.ts](src/ui/hud/state.ts) — `enemyCtxMenu` ref.
- [src/ui/hud-overlay.ts](src/ui/hud-overlay.ts) — create `#enemy-ctx-menu`; extend outside-click dismissal.
- [src/input.ts](src/input.ts) — RMB enemy hit-test → open menu vs. waypoint.
- [src/ui/hud/overview.ts](src/ui/hud/overview.ts) — optional row right-click.

## Reuse (don't reinvent)
- Orbit three-zone steering: [npc-ai.ts:94-109](src/physics/npc-ai.ts#L94-L109).
- Enemy id→entity resolution: `enemyByLockId` [targeting.ts:82-87](src/targeting.ts#L82-L87).
- Lock request: `requestSensorLock(id)` (used at [input.ts:162](src/input.ts#L162)).
- Menu show/hide/clamp + outside-click dismissal: [turret-menu.ts](src/ui/hud/turret-menu.ts) + hud-overlay.ts.
- World hit-test + screen→world coords: [input.ts:156-166](src/input.ts#L156-L166), `Client.mouseWorld`.
- px↔km scale: [config/targeting.ts:3-4](src/config/targeting.ts#L3-L4).

## Verification
1. `npm run dev` (or the project's run command); fly into an enemy system.
2. **Right-click an enemy** → menu appears at cursor, clamped on-screen near edges.
3. **Orbit ▸ 10 km** → ship flies to ~10 km and circles; held even as the enemy moves.
4. **Keep at Range ▸ 20 km** → ship closes to / backs off to ~20 km and holds, nose on target.
5. **Lock / Unlock** entries reflect and toggle current lock state.
6. **Stop**, or **right-click empty space** (sets a waypoint), cancels the maneuver.
7. Kill the orbited enemy → `navCommand` clears, ship reverts to manual control (no errors).
8. Right-click on a **turret slot** still shows the turret menu; native browser menu never appears in the world.
9. Type-check / build passes (`tsc` / project build).
