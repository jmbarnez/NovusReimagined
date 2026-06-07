# Fix Cargo Panel Toolbar

## Root Cause
`emit("inventory:changed")` in `src/net/snapshot-apply.ts` is fired unconditionally on every snapshot apply. `rerenderInventory()` in `src/ui/inventory/index.ts` rebuilds `innerHTML` even when neither content nor selection has changed. In a 60fps loop the cargo panel DOM is destroyed and recreated every frame, which:
- Steals focus from the search input so typing never registers
- Destroys buttons between `mousedown` and `click`, so clicks are lost

## Fix
1. In `rerenderInventory()` (`src/ui/inventory/index.ts`), skip the rebuild when `hash === _lastContentHash` and selection is unchanged.
2. (Optional) In `snapshot-apply.ts`, guard `emit("inventory:changed")` so it only fires when inventory/fitting data actually changed.
3. Add a regression test.
4. Run `npm run typecheck` and `npm run test:run`.

## Files to edit
- `src/ui/inventory/index.ts`
- `src/net/snapshot-apply.ts` (optional but recommended)
- `tests/hangar-cargo-toolbar.test.ts` (new regression test)
