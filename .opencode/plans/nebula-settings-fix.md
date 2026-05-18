# Nebula, Settings & Visual Fixes

## Problem Summary
1. Nebulae invisible — puffs too faint, `nebulaQuality` stuck at "high" regardless of Background settings
2. Blue blob in bottom-right — likely a far-layer nebula sprite (parallax 0.008, barely moves)
3. Player ship disappears at low zoom
4. Settings panel has phantom/disconnected toggles
5. Not enough nebulae

## Changes Required

### 1. `src/render/pixi-background.ts` — Fix nebula quality reading & increase visibility

**Line ~484**: Change `nebulaQuality` → `backgroundDetail` and adjust multipliers:
```ts
// BEFORE:
const q = Client.settings?.nebulaQuality || "high";
// AFTER:
const q = Client.settings?.backgroundDetail || "high";
```

Also adjust multipliers to match star density scaling:
```ts
// BEFORE:
const mult = q === "low" ? 0.35 : q === "medium" ? 0.6 : 1.0;
// AFTER:
const mult = q === "low" ? 0.4 : q === "medium" ? 0.65 : 1.0;
```

**Comment update**: Change the comment from `nebulaQuality` to `backgroundDetail`:
```ts
// BEFORE: "high" quality; scaled by the nebulaQuality multiplier.
// AFTER:  "high" quality; scaled by the backgroundDetail multiplier.
```

**Previous edits already applied (verify these are in the file)**:
- ARCH_CFG counts increased (void: 5/4/2, dust-lane: 6/10/5, wisps: 7/12/6, pillars: 8/14/7, dense: 10/18/10)
- LAYER_BASE sizes increased (far: 1100/0.28, mid: 680/0.40, near: 420/0.38)
- Puff alphas increased (body: 0.08-0.18, wisp: 0.08-0.18, core: 0.10-0.22)
- Cloud sheet alphas increased (0.04-0.06)
- Elliptical puffs with random rotation added
- Multi-stop gradient with softer falloff

### 2. `src/data/settings.ts` — Remove orphaned fields

**Remove `nebulaQuality`** (line 39): This is now handled by `backgroundDetail`.

**Remove `bloomQuality`** (line 38): The Bloom toggle is on/off only; no quality selector exists.

Changes needed:
- Remove `nebulaQuality: string;` from interface (line 39)
- Remove `bloomQuality: string;` from interface (line 38)
- Remove `nebulaQuality: "high",` from DEFAULT_SETTINGS (line 136)
- Remove `bloomQuality: "high",` from DEFAULT_SETTINGS (line 135)
- Remove `nebulaQuality: parsed.nebulaQuality || "high",` from loadSettings (line 163)
- Remove `bloomQuality: parsed.bloomQuality || "high",` from loadSettings (line 162)

### 3. `src/ui/settings.ts` — Fix settings panel

**A. Add Color Grading toggle** — after the "Atmospheric Rim" toggle row (around line 96):

Add this HTML in the settings panel:
```html
<div class="settings-row settings-toggle-row">
  <label>Color Grading</label>
  <input type="checkbox" id="color-grade-toggle" class="toggle-switch" checked>
  <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Per-system colour tint that shifts warm/cool based on star class. Applies a PixiJS ColorMatrixFilter.">ⓘ</span>
</div>
```

Add event listener (after the `#atm-rim-toggle` listener, around line 213):
```ts
el.querySelector("#color-grade-toggle")!.addEventListener("change", (e) => {
  Client.settings.colorGrading = (e.target as HTMLInputElement).checked;
  saveSettings(Client.settings);
});
```

Add to `renderSettings()` (after the atmRimToggle, around line 283):
```ts
const colorGradeToggle = document.getElementById("color-grade-toggle") as HTMLInputElement | null;
if (colorGradeToggle) colorGradeToggle.checked = settings.colorGrading ?? true;
```

**B. Implement Ambient Falloff** — The toggle exists but has no rendering code.

Option: Implement a simple radial brightness near the star position. Add to `src/render/pixi-background.ts` or create a function in `src/render/background.ts`.

Simplest implementation — add an ambient falloff pass in `drawBackground()` in `src/render/background.ts`:
```ts
if (Client.settings?.ambientFalloff !== false) {
  const sx = Wc / 2 - Client.camx * 0.003;
  const sy = Hc / 2 - Client.camy * 0.003;
  const ambR = Math.hypot(Wc, Hc) * 0.45;
  const amb = ctx.createRadialGradient(sx, sy, 0, sx, sy, ambR);
  amb.addColorStop(0, "rgba(255,240,210,0.06)");
  amb.addColorStop(0.5, "rgba(255,220,180,0.025)");
  amb.addColorStop(1, "transparent");
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, Wc, Hc);
}
```

**C. Re-enable Lens Flare** — Uncomment the call in `src/game-loop.ts` around line 181:

Change:
```ts
// if (Client.settings?.lensFlare !== false) drawLensFlare(Wc, Hc, camxR, camyR, Client.zoom, sys);
```
to:
```ts
if (Client.settings?.lensFlare !== false) drawLensFlare(Wc, Hc, camxR, camyR, Client.zoom, sys);
```

**D. Remove `nebulaQuality`/`bloomQuality` references** — the settings.ts already has the "Background" buttons that call `initBackgroundStars()` and invalidate `_nebulaBlobs`. This is correct — just need to make sure the nebula regeneration uses `backgroundDetail` (see change #1).

### 4. `src/render/pixi-player.ts` — LOD scaling (already applied)

Verify the change at the LOD section exists:
```ts
const lodScale = Math.max(Client.zoom, 0.55);
_hullSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);
```
And for the light sprite:
```ts
_hullLightSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);
```

### 5. Settings `initBackgroundStars` call

In `src/ui/settings.ts`, the Background detail buttons already:
1. Set `settings.backgroundDetail`
2. Call `initBackgroundStars(settings.backgroundDetail)`
3. Invalidate `sys._nebulaBlobs = undefined` for all systems
4. Save settings

This is correct. Once `ensureBlobs` reads `backgroundDetail` instead of `nebulaQuality`, the Background setting will properly control both stars AND nebulae.

## Blue Blob Diagnosis

The "blue blob always in the bottom right" is most likely a **far-layer nebula sprite** with `hue` matching a blue value from `sys.nebulaHues[0]`. Far-layer parallax is 0.008 — a 1000px camera shift only moves the nebula 8px, making it appear fixed.

The reason only ONE blob is visible while others are invisible: the current alpha values are too low for most puffs to be perceptible, but one with a particularly high random alpha multiplier might accumulate enough opacity to be visible. The other blobs blend into the background.

After increasing all the alphas (already done), ALL nebulae should become visible, and the "strange blue blob" should resolve into a proper nebula cloud that's part of the overall scene. If it still appears misplaced, we can address it specifically.

## Summary of Files to Edit

| File | Changes |
|------|---------|
| `src/render/pixi-background.ts` | Change `nebulaQuality` → `backgroundDetail`, update comment, adjust multipliers |
| `src/data/settings.ts` | Remove `nebulaQuality` and `bloomQuality` fields |
| `src/ui/settings.ts` | Add Color Grading toggle, implement Ambient Falloff rendering, re-enable Lens Flare |
| `src/game-loop.ts` | Uncomment `drawLensFlare` call |
| `src/render/background.ts` | Add `ambientFalloff` rendering code |
| `src/render/pixi-player.ts` | Verify LOD scaling fix (already applied) |