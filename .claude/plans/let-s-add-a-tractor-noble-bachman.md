# Tractor + Hub — Layer 2 (knob, constant energy, longer processing, hub tooltip)

## Context

The base tractor-beam + industrial-hub system is already implemented and compiles
(`src/tractor.ts`, `src/hub.ts`, the hub window in `src/ui/hud-overlay.ts`, the hub structure in
`src/world-gen.ts`/`src/render/pixi-stations.ts`). This second pass deepens it per the user's request,
to make the loop feel more like a real industrial process and give the tractor tactile control:

1. **Processing should take much longer** — jobs currently finish in only ~5-8s; make them industrial (~1-3 min).
2. **Hover tooltip on the hub** — hovering the processing hub shows live production status.
3. **Tractor tightness knob** — a HUD dial the player turns to loosen/tighten the beam.
4. **Constant energy use** — the tractor should drain capacitor continuously while its beam is
   engaged, like the other laser turrets (mining laser / salvager), not only while actively pulling.

Confirmed decisions: knob is a **HUD dial widget** by the powered tractor turret slot (drag/scroll to
turn); tightness trades **pull strength ↔ capacitor drain** (energy is always consumed while the beam
is on); processing is **long / industrial (~1-3 min)**.

---

## Part A — Longer processing (`src/hub.ts`)

Bump the two job durations in `updateHub`:
- Debris: `5 + mass/500` → **`50 + mass/40`** (~60-90s).
- Asteroid: `8 + mass/400` → **`110 + mass/30`** (~2-3 min).

At minute scale the raw `${Math.ceil(remaining)}s` readout is ugly. Add a small `fmtDuration(s)` →
`m:ss` (or `Ns` under a minute) helper and use it for the ETA in `renderHubWindowContent`
(`src/ui/hud-overlay.ts`, currently line ~342) and the new hub tooltip (Part C).

## Part B — Tractor tightness knob + constant energy

**State (persisted).** Add `tractorTightness: number` (0..1, default `0.5`) to the `Player` interface
(`src/state.ts`, next to `tractorCarryKg`), set it in `makePlayer()` and add a `loadPlayer()` migration
(`if (typeof p.tractorTightness !== "number") p.tractorTightness = 0.5`) in `src/player/player-data.ts`.

**Effect mapping (`src/tractor.ts`).** Read `const t = G.P.tractorTightness ?? 0.5`:
- pull-accel multiplier = `0.45 + t*1.10` (loose = gentle, tight = strong).
- cap-drain multiplier = `0.5 + t*1.5` (loose sips, tight guzzles → ~1.5/s … 6/s on the base `capDrainPerSec:3`).

**Constant energy (`src/tractor.ts updateTractor`).** Restructure so the beam is *engaged* whenever
there's a powered tractor slot **and** a resolved locked target within range — **including over-mass
targets**. While engaged, drain `capDrainPerSec * drainMult * dt` every tick (continuous, mirroring the
mining laser's `energyCostPerSec` and the salvager). Branches:
- Cap can't cover the drain → beam sputters off, "No cap" float, `setCarryKg(0)`.
- Too heavy (`mass > maxMass`) → **still drain** (beam straining), show "Too heavy", apply **no** pull,
  `setCarryKg(0)`, keep beam state for the renderer (strain look).
- Within mass → drain, apply pull `pullAccel * pullMult`, `setCarryKg(mass)`, normal beam.

**Avoid double-drain.** The generic active-module cap loop in `src/physics/ship.ts:124-146` drains
turret modules off `slotActive` (which stays `true` for turrets), independent of `turretPower`. Skip the
tractor there — `if (MODULE_FLAGS.isTractor(m)) continue;` — so tractor energy is owned solely by
`tractor.ts` and the knob fully governs it. (Leave the salvager untouched.)

**Dial widget — new `src/ui/hud/tractor-dial.ts`** (create-once DOM pattern from `src/ui/hud/slotTooltip.ts`):
- Export `updateTractorDial()`, called each frame from `updateHud` in `src/ui/hud-overlay.ts`
  (right by `updateHubWindowIfOpen()`, ~line 275).
- Create `#tractor-dial` once as a child of `#hud-overlay`. Because `src/input.ts` already bails on
  `closest("#hud-overlay > *")` for both the `wheel` (no zoom) and lmb `mousedown` (no world-lock)
  handlers, the dial gets clean scroll/drag for free — its own listeners just need to adjust the value.
- Show it **only when a tractor turret is powered** (scan `fitting.turret` for `MODULE_FLAGS.isTractor`
  + `turretPower[idx]`); anchor above that slot via `hudState.slotNodes.get('turret|'+idx)` →
  `getBoundingClientRect()`. Hide otherwise.
- Render a circular dial: rotating pointer + arc fill + `%`, a caption ("GRIP"/"TRACTOR"), and a tiny
  pull/cap readout — all reflecting `G.P.tractorTightness`.
- Interaction: `wheel` → ±0.05; `mousedown` + vertical drag (track on `document` until mouseup, up =
  tighter) → set value; clamp `[0,1]`; `savePlayer()` on release. Optional `sfx`.
- CSS: add a `#tractor-dial` block to `src/ui/styles/hud-misc.css`.
- Optional polish: `drawTractorBeam` (`src/render/world/combat.ts`) reads `G.P.tractorTightness` to vary
  beam thickness/brightness.

## Part C — Hub production-status tooltip — new `src/ui/hud/hub-tooltip.ts`

Same create-once DOM pattern as `slotTooltip.ts`:
- Export `updateHubTooltip(sys)`, called each frame from `updateHud` (after `updateDockPrompt(sys)`).
- Find the hub (`sys.stations.find(s => s.isProcessingHub)`); treat as hovered when
  `dst(Client.mouseWorld, hub) < hub.radius + ~40` and no full-screen overlay is open
  (`!Client.stationOpen && !Client.showMap && !Client.bridgeOpen && !Client.settingsOpen`).
- Position the element at `Client.mouse.x/y` (screen coords — same as the cursor/reticle).
- Content = production status: each active `G.P.hubQueue` job (Debris/Asteroid, progress %, ETA via
  `fmtDuration`), then a pending `hubOutput` summary (scrap/ore/modules), else
  "Idle — tow debris or asteroids into the ring." Reuse the label/percent logic already in
  `renderHubWindowContent`.
- Hide when not hovered.

---

## Critical files
- `src/hub.ts` — longer durations + `fmtDuration` helper.
- `src/state.ts` + `src/player/player-data.ts` — persisted `tractorTightness` (+ migration).
- `src/tractor.ts` — tightness→pull/drain mapping; constant beam-on drain incl. too-heavy.
- `src/physics/ship.ts` — exclude tractor from the generic cap-drain loop.
- `src/ui/hud/tractor-dial.ts` (new) + hook in `src/ui/hud-overlay.ts` + `src/ui/styles/hud-misc.css`.
- `src/ui/hud/hub-tooltip.ts` (new) + hook in `src/ui/hud-overlay.ts`.
- `src/render/world/combat.ts` — (optional) beam thickness from tightness.

## Reuse (do not reinvent)
- Create-once DOM tooltip/widget pattern: `src/ui/hud/slotTooltip.ts`.
- Per-frame HUD host (already iterates jobs / dock prompt): `updateHud` in `src/ui/hud-overlay.ts`.
- Job progress/label formatting: `renderHubWindowContent` in `src/ui/hud-overlay.ts`.
- Module flag + slot scan: `MODULE_FLAGS.isTractor` (`src/data/modules.ts`), `hudState.slotNodes` (`src/ui/hud/slots.ts`).
- Continuous-drain reference: mining laser `energyCostPerSec` (`src/config/player.ts`), salvager (`src/salvager.ts`).
- Input guards that let `#hud-overlay` children swallow wheel/mouse: `src/input.ts` (wheel + mousedown `closest` checks).

## Verification
1. `npx tsc --noEmit` — clean.
2. Run the game (`/run`) in the starter system:
   - Power the tractor (no lock) → the dial appears by the slot; no cap drain yet.
   - Lock a small object → beam engages and capacitor drains **continuously**. Turn the dial **tighter**
     → pull visibly faster and cap drains faster; **looser** → gentle pull, low drain. Reload → tightness persists.
   - Lock an **over-mass** object → "Too heavy", beam still drains cap (straining), object doesn't move.
   - Tow debris/asteroid into the hub ring → absorbed; open the hub window (F) → ETA now shows minutes (`m:ss`).
   - Hover the hub with the reticle/cursor → production-status tooltip shows active jobs + ETA + pending
     output; move away → it hides.
