# Station UI Theme-Token Migration

## Context

The codebase has one theming convention: a set of `--hud-*` CSS custom properties live on
`:root` (defined in [hud-base.css](src/ui/styles/hud-base.css#L8-L39)) and are rewritten at
runtime by `applyTheme()` in [hud-overlay.ts](src/ui/hud-overlay.ts#L275-L315) from the active
`UITheme`. This drives all 26 themes in [settings.ts](src/data/settings.ts#L119) (`HUD_THEMES`).
The token block is explicitly documented as covering "HUD, bridge windows, **station screens**,
settings."

The HUD, bridge, settings, and title screen obey this. **The station UI does not** — it hardcodes
hex/rgba literals throughout its CSS and a few TS inline styles, so switching themes recolors the
whole game *except* the docked station screens, which stay frozen on the Midnight palette.

Goal (per user): **full token migration** — the station UI should fully respond to theme switching
like every other surface, adding new tokens only where no equivalent exists.

## Approach

Replace hardcoded colors in station CSS + TS with `var(--hud-*)` tokens. Where a station color is a
*derived* shade (dimmer text, translucent surface, tinted border) with no exact token, use
`color-mix(in srgb, var(--token) N%, transparent|black)` — the same derivation pattern already used
in [bridge.css](src/ui/styles/bridge.css). This avoids inventing per-theme tokens for every shade.

### Token mapping (apply consistently across all station CSS/TS)

| Hardcoded family | Replace with |
|---|---|
| `#cfe0f5`/`#c0d8ee` (brightest text) | `var(--hud-text-bright)` |
| `#9eb6d4`/`#8aacbc`/`#8ab0c8` (body/value text) | `var(--hud-text-main)` |
| `#7a8fa8`/`#7a9aaa` (secondary) | `var(--hud-text-dim)` |
| `#5a7080`/`#4a6070`/`#3d5060`/`#2e4050` (faint/labels) | `var(--hud-text-faint)` (+ `color-mix` darker for the faintest) |
| `rgba(2,5,10,*)` | `var(--hud-bg-deep)` |
| `rgba(10,15,25,*)` panels, `rgba(4,8,14,*)` | `var(--hud-bg-panel)` (+ color-mix for opacity tweaks) |
| `rgba(20,32,48,*)`, `rgba(30,42,58,*)` raised | `var(--hud-bg-elevated)` |
| `rgba(30,50,70,*)`/`rgba(40,60,80,*)` borders | `var(--hud-border)` / `var(--hud-border-soft)` |
| greens: buy `#58a870`, positive `#66ff88`, `#44ffaa` | `var(--hud-positive)` (derive light/dark via color-mix) |
| reds: sell `#a85858`, danger `#ff4444`/`#cc5533`, alerts | `var(--hud-danger)` |
| golds: reward `#c8a855`, industry `#c8b43c`, accents | `var(--hud-accent)` |
| cyans: shield-ish `#3888a8`/`#44ccff` tab/io | `var(--hud-shield)` |
| oranges: hull/durability `#ee9944`/`#ff8844`/`#c0803c` | `var(--hud-hull)` |
| purple: skills/train tab `#7733cc`/`#8858a8`/`#140080` | new token `--hud-arcane` (see below) |

### One new token: `--hud-arcane` (skills/industry-purple accent)

No existing token is purple. Add it **without editing all 26 themes** by giving it an inline
fallback:

- `UITheme` interface ([settings.ts](src/data/settings.ts)): add optional `arcane?: string`.
- `applyTheme()` ([hud-overlay.ts](src/ui/hud-overlay.ts#L302-L308)): add
  `s.setProperty("--hud-arcane", t.arcane ?? "#8858a8");` alongside the other semantic accents.
- `:root` default in [hud-base.css](src/ui/styles/hud-base.css#L26-L32): add `--hud-arcane: #8858a8;`.
- Optionally set a tuned `arcane` value on `default`/a few flagship themes; the `??` fallback keeps
  the rest valid.

### Files to edit

CSS (replace literals → tokens per table above):
- [station-base.css](src/ui/styles/station-base.css) — sidebar, tabs (incl. `[data-tab]` accent
  rules L122-125 → shield/positive/accent/arcane), buttons (`.btn`/`.btn-buy`/`.btn-sell`/
  `.btn-train`), `.al`, `h3`/`h4`, `.row`/`.lbl`/`.val` utilities.
- [station-hangar.css](src/ui/styles/station-hangar.css), [station-market.css](src/ui/styles/station-market.css),
  [station-industry.css](src/ui/styles/station-industry.css) (largest — IO pills, queue gradients,
  `ind-btn-primary`), [station-contracts.css](src/ui/styles/station-contracts.css),
  [station-fitting.css](src/ui/styles/station-fitting.css) (stat deltas, slot borders).

TS inline styles → tokens (use `var(--hud-*)` in the template strings):
- [station.ts:163](src/ui/station.ts#L163) — security badge `#44ff88/#ffcc44/#ff4444` →
  `var(--hud-positive)/var(--hud-accent)/var(--hud-danger)`.
- [hangar.ts:101](src/ui/station/hangar.ts#L101) — module offline/damage `#ff4444`/`#ff8844` →
  `var(--hud-danger)`/`var(--hud-hull)`; the misc `color:#3d5060` box (L238) →
  `var(--hud-text-faint)`.

### Intentionally NOT theme-tokenized (semantic, data-driven palettes)

These are item/category identity colors, not chrome, and should stay a centralized fixed palette:
- **Rarity colors** — already data-driven (`rarityCfg.color`) and applied via inline
  `border-left`/`color` in [hangar.ts](src/ui/station/hangar.ts) / [station-fitting.css](src/ui/styles/station-fitting.css). Leave as-is.
- **`iconSvg()` rack/resource colors** in [shared.ts](src/ui/station/shared.ts) (turret/high/med/low,
  ore/loot/comp/ammo). Leave as a fixed semantic palette. (Flag for the user if they want these
  themed too — out of scope here.)

## Verification

1. `npm run build` (or the project's typecheck/lint) passes — confirms the new `arcane` token wiring
   and no CSS breakage. Check [package.json](package.json) for the exact script.
2. Run the app (`/run` skill or `npm run dev`), dock at a station, and cycle through several themes
   in Settings (e.g. Midnight → Matrix → Crimson → Synthwave). Confirm **every** station panel —
   sidebar/tabs, Hangar (fitting + inventory), Market (buy/sell rows), Industry (recipe list, IO
   pills, queue progress bars), Contracts — recolors with the theme, matching the HUD/bridge.
3. Grep the station CSS files for residual hex/`rgba(` literals after migration; the only expected
   remainders are pure-black scanline/shadow overlays (e.g. `rgba(0,0,0,*)`) and the intentionally
   fixed rarity/icon palette noted above.
