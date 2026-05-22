# Plan: Inset the game frame between the HUD bars + diagnose the 60fps cap

## Context

Two related issues, both touching the recent "game frame between the top lock-rail and bottom HUD bar" layout work:

1. **FPS reads 60, was ~200 before the HUD-bar layout work.** You're on a high-refresh monitor (144/240Hz), so 60 is a genuine regression rather than a vsync ceiling.
2. **The game frame isn't actually drawn between the bars.** Both render surfaces are full-screen and the opaque DOM bars just sit on top. The world still renders behind the bars (wasted fill), and the layout is currently held together by a hack.

### What the code actually does today

- The render loop is driven by `requestAnimationFrame` ([game-loop.ts:72](src/game-loop.ts#L72)). This is unchanged since the initial commit. **RAF can never deliver frames faster than the monitor refresh rate, and if a frame is too heavy to finish within a refresh interval the browser steps the rate down (240 → 120 → 80 → 60 …).**
- The FPS counter literally counts RAF callbacks per second ([perf-overlay.ts:76](src/render/perf-overlay.ts#L76)). So "60 fps" = RAF is being delivered at 60Hz.
- The layout is **inconsistent / half-migrated**:
  - [canvas.ts:18-19](src/canvas.ts#L18-L19) and [pixi.ts:55-57](src/pixi.ts#L55-L57) were changed to size both canvases to the **full window**.
  - But [viewport.ts:26-30](src/render/viewport.ts#L26-L30) compensates with a hack: it offsets the camera *center* down by `LOCK_RAIL_H` and up by `HUD_BOTTOM_H` so the ship looks centered in the gap — while the canvas itself still spans the whole screen.
  - Meanwhile [pixi-background.ts:151-152](src/render/pixi-background.ts#L151-L152) and [pixi-nebula-gpu.ts:225-226](src/render/pixi-nebula-gpu.ts#L225-L226) still use the **old** inset model (`innerWidth - HUD_SIDE_W`, `innerHeight - HUD_BOTTOM_H`) — so the screen-space background is sized to a different rectangle than the canvases.
  - [game-loop.ts:228-229](src/game-loop.ts#L228-L229) has a comment claiming an "End of clipped game-frame region," but **there is no `ctx.clip()` anywhere** — the comment is aspirational/stale.
- `setViewMaskEnabled()` ([pixi.ts:128-130](src/pixi.ts#L128-L130)) is a no-op stub.

The original commit sized the canvas to `innerWidth - HUD_SIDE_W` × `innerHeight - HUD_BOTTOM_H` (inset on right + bottom only, never the top) with `viewCenterY = Hc/2`. The regression came from switching to full-window + the camera-center hack instead of extending the inset to include the top lock-rail.

### Honest note on the FPS root cause

Static analysis does **not** reveal a 3x regression. The PixiJS config (antialias, `resolution` = DPR cap 2.5, color-grade filter, `autoStart:false`) is identical to the initial commit, `renderScale` default is still 2.5, and the canvas only grew by ~95px of height (~6% more pixels). None of that explains 200 → 60 on its own. So the FPS fix has a **layout half** (do it — it's correct and reduces fill) and a **profiling half** (measure to find the real bottleneck — we can't read it out of the source).

---

## Part A — Make the game frame truly inset between the bars

Unify everything on a single **play-rect** model: when `Client.gameStarted`, the play rect is
`left=0, top=LOCK_RAIL_H (102), width=innerWidth−HUD_SIDE_W (=innerWidth, since HUD_SIDE_W=0), height=innerHeight−LOCK_RAIL_H−HUD_BOTTOM_H`.
On the title screen (`gameStarted` false) both surfaces stay full-screen, as today.

The key win: both the 2D canvas (`#c`) and the Pixi renderer become the **same** play-rect size and position, so the existing `viewCX`/`viewCY` and `worldContainer` transform math in the loop "just works" in play-rect coordinates for both layers, and `viewCenterY` reverts to plain `Hc/2`.

1. **[canvas.ts](src/canvas.ts) `resize()`** — restore the inset sizing and add the top offset:
   - `uiTop = Client.gameStarted ? LOCK_RAIL_H : 0`, `uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0`, `uiRight = Client.gameStarted ? HUD_SIDE_W : 0`.
   - `_canvasW = innerWidth − uiRight`, `_canvasH = innerHeight − uiTop − uiBottom`.
   - Set `canvas.style.top = uiTop + "px"` (currently hard-coded `"0"`).
   - Re-import `HUD_SIDE_W, HUD_BOTTOM_H, LOCK_RAIL_H` from constants.

2. **[pixi.ts](src/pixi.ts) `initPixi` + `resizePixi`** — size the renderer to the play rect and offset the canvas:
   - Use the play-rect width/height (mirror the canvas.ts computation, or import `W()`/`H()` once they reflect the play rect) for `app.init({width,height})` and `app.renderer.resize(...)`.
   - Set `pixiCanvas.style.top = uiTop + "px"`.
   - Base `filterArea` Rectangle uses the play-rect dimensions.
   - Either delete the dead `setViewMaskEnabled` stub or leave it as the documented "masking is done via canvas dimensions" no-op (its comment already says so). Prefer deleting if nothing calls it meaningfully.

3. **[viewport.ts](src/render/viewport.ts) `viewCenterY`** — revert the hack to `return Hc / 2;` and drop the now-unused `LOCK_RAIL_H` import and `Client` import if it becomes unused. `viewCenterX` stays `Wc/2`.

4. **[pixi-background.ts:149-152](src/render/pixi-background.ts#L149-L152) and [pixi-nebula-gpu.ts:223-226](src/render/pixi-nebula-gpu.ts#L223-L226)** — replace the ad-hoc `innerWidth/innerHeight − ui*` math with the shared play-rect size (call `W()`/`H()` from canvas.ts, which now return the play rect). This makes the screen-space background match the canvases instead of a third, different rectangle.

5. **[game-loop.ts](src/game-loop.ts)** — no transform math changes needed (it already uses `W()`/`H()` and `viewCenterX/Y`, which now describe the play rect for both layers). Clean up the stale "clipped game-frame region" comment at lines 228-229; with an inset `#c` the canvas bounds *are* the clip, so the comment becomes accurate or can be removed.

6. **Resize wiring** — confirm `window` `resize` and the title→space transition both re-run `resize()` (canvas) and `resizePixi()`. `enterSpaceMode` already dispatches a `resize` event ([game-loop.ts:292](src/game-loop.ts#L292)) after setting `Client.gameStarted = true`; verify the pixi resize is subscribed to the same event (check [main.ts](src/main.ts)). Also resize on space→title/station transitions so the surface returns to full-screen on the title.

### Things to verify visually (inset side-effects)
- **Full-screen takeover overlays** drawn on `#c`: `drawGalaxyMap`, `drawSystemMap`, `drawWarpScreen` ([hud.ts:549,582,709](src/render/hud.ts#L549)). With an inset `#c` they cover only the play area, leaving the bars visible around them. The original already left the right/bottom bars uncovered, so extending to the top is consistent — but confirm it looks right. If a true full-screen takeover is wanted, those specific overlays would need their own full-screen layer (out of scope unless it looks wrong).
- **Damage flash / lens flare** ([game-loop.ts:232-263](src/game-loop.ts#L232-L263)): now fill the play rect rather than the whole window — expected and fine.
- **`drawHUD`** centers its semicircular HUD at `Wc/2, Hc/2` ([hud.ts:41-42](src/render/hud.ts#L41-L42)) — now the play-rect center, which is the intent. The minimap is a separate DOM canvas in `#hud-minimap`, unaffected.

---

## Part B — FPS: reduce fill (free with Part A), then profile to find the real bottleneck

1. **Part A already helps**: not rendering the ~197px of top+bottom bands (at DPR up to 2.5 that's a real fragment-count reduction) and not drawing world content behind opaque bars lowers GPU fill. This is the first lever.

2. **Measure with the existing Performance overlay** (`Client.showPerf`, drawn by [drawPerfOverlay](src/render/perf-overlay.ts#L117)) — it already reports `avg / min / max` frame time in ms. With the FPS pinned at 60, read `avg ms`:
   - **avg ≈ 16ms** → genuinely GPU/CPU-bound at the 60Hz step → keep reducing per-frame cost (below).
   - **avg ≪ 16ms (e.g. 3–6ms) with fps stuck at 60** → *not* compute-bound; RAF is being throttled to 60Hz by compositing/environment (e.g. Chrome compositing the stacked `position:fixed` canvases + DOM HUD at 60, GPU power-saving, or the window living on a 60Hz output). In that case raw optimization won't raise it; the fix is about the compositing path / browser settings, and we'd confirm the high-refresh path is actually engaged.

3. **If GPU-bound, bisect the heavy pass** by toggling settings one at a time (all already exist in [data/settings.ts](src/data/settings.ts)) and watching `avg ms`: `colorGrading` (full-screen `ColorMatrixFilter` on `worldContainer`), the GPU nebula ([pixi-nebula-gpu.ts](src/render/pixi-nebula-gpu.ts)), `vignetteEnabled`, and `renderScale` (lowering the DPR cap from 2.5 is the single biggest fragment-count lever). Whichever toggle restores high FPS identifies the bottleneck to optimize.

---

## Verification

- Run the app (dev server) and play in SPACE mode. Confirm the game world is rendered strictly in the band between the top lock-rail and the bottom HUD bar, with the bars sitting flush against the play area (no world bleeding under them, no gap/double-offset).
- Enable the FPS counter (`fpsCounter` setting) and open the Performance overlay; record `fps` and `avg ms` before vs after Part A.
- Resize the window, and transition title → space → station → title; confirm the surface re-insets in game and returns to full-screen on the title with no misalignment between the Pixi background and the 2D canvas.
- Open the galaxy/system map and trigger a warp; confirm those overlays look acceptable within the inset (decide whether they need full-screen treatment).
- Follow the Part B measurement to determine whether the 60 cap is compute-bound (optimize) or compositing/environment-bound (report findings; no code fix can exceed refresh rate).
