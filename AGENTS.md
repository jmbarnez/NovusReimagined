# Star Sonata — Developer Guide

## Core Documentation
- **[Architecture & Conventions](docs/architecture.md)** — State management rules, Event bus, Key patterns, and Adding new content.
- **[Developer To-Do List](docs/todo.md)** — Architectural debt tracker and a list of resolved debt items.

## Agent Operating Principles

### 1. Server-Authoritative Architecture
Star Sonata uses a **server-authoritative** simulation. Whether the user is playing single-player or multiplayer, the server owns game state; the client renders and sends inputs. Never implement client-side shortcuts that bypass server validation, and never assume game logic should live only in the client. When in doubt, push state changes to the server.

### 2. Best Code Practices
- Write clean, idiomatic TypeScript.
- Prefer explicit types over inference in public APIs.
- Keep functions small and single-purpose.
- Avoid duplication; refactor shared logic into well-named utilities.
- Write or update tests for any non-trivial change.
- Leave the codebase cleaner than you found it.
- **File editing**: Always use the `write` tool instead of `edit`. Before modifying a file, read it first to get the current content, then rewrite the entire file with your changes. This avoids stale content conflicts and ensures clean diffs.
- **Pixi-only rendering**: All in-game rendering goes through PixiJS. The screen `<canvas id="c">` and `src/canvas.ts` were removed in the canvas-to-Pixi migration (see `docs/audit-2026-06-01.md`); `src/canvas.js` no longer exists. New code must not import from `canvas.js`, acquire a `CanvasRenderingContext2D`, or call `getElementById("c")`. `tests/canvas-2d-ban.test.ts` enforces this.

### 3. Self-Criticism & Review
Before finalizing any change, pause and critically evaluate your own work:
- **Does this violate the architecture?** (Check `docs/architecture.md`.)
- **Could this introduce a type or runtime bug?** (Re-read your diff with a skeptic's eye.)
- **Is there a simpler or more robust way?** (Prefer the straightforward solution over the clever one.)
- **Would another developer understand this immediately?** (Add clarity, not complexity.)
If you spot a flaw in your own reasoning, fix it before presenting the result.

### 4. Proactive Recommendations
The user is open to **all** ideas. Do not limit suggestions to the immediate request. If you see opportunities for:
- Refactoring, deduplication, or cleaner abstractions
- Feature enhancements or UX improvements
- Performance optimizations
- Architectural alignment or test coverage gaps

…raise them. A good pull request fixes the bug; a great one also leaves the surrounding code better than it was.

### 5. Event Bus & Decoupling
Use the event bus for cross-system communication instead of direct imports or tight coupling. Check `docs/architecture.md` for the event bus pattern. Favor loose coupling so systems can evolve independently.

### 6. State Immutability
Treat state objects as immutable. Replace rather than mutate. This prevents subtle reactivity and render bugs, especially when diffing or syncing state across client and server.

### 7. Frame Budget / Hot Path Awareness
This is a canvas game. Avoid allocations, heavy loops, or unnecessary object creation inside the render and update loops. Consider object pooling for frequently spawned and destroyed entities (projectiles, particles, wreckage).

### 8. UI vs. Simulation Separation
Keep HUD and UI logic decoupled from combat, docking, and economy simulation. The client renders state; it does not decide outcomes. Presentation code should never mutate simulation state directly.

### 9. Error Handling & Graceful Degradation
Never crash the game loop due to a malformed packet, missing asset, or unexpected null. Log the anomaly, degrade gracefully, and recover. This is especially critical for multiplayer paths where untrusted input is a reality.

### 10. Communication Style
Be concise and direct. Avoid unnecessary preamble, validation phrases, or filler. When referencing existing code, always use citations with file paths and line numbers. Favor short paragraphs and bullet points over long blocks of text.

## Build Commands

```bash
npm run dev        # Start dev server with hot reload
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm run check      # Build to catch type/syntax errors (alias: vite build)
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (watch)
npm run test:run   # Vitest (single run)
npm run lint       # Linter (currently a no-op placeholder)
```

## TypeScript & Type Safety Guidelines

To maintain type integrity and avoid subtle runtime bugs, adhere to the following rules:

### 1. Strict Prohibition of the `any` Keyword
- **No explicit `any` declarations**: Avoid declaring parameters, variables, fields, or function return types as `any`.
- **No loose `as any` typecasts**: Do not use `as any` to bypass compile-time checks. If a type mismatch occurs, refactor the interfaces or declare a proper union/intersection type instead.

### 2. Alternatives to `any`
- **Use `unknown` for unsafe boundaries**: When parsing input, loading external save state, or interacting with generic structures where the type is truly undetermined, use `unknown`.
- **Narrow types with guards**: Use type predicates (`x is T`), `typeof`, or `instanceof` checks to safely narrow `unknown` values:
  ```typescript
  function isString(val: unknown): val is string {
    return typeof val === "string";
  }
  ```
- **Type indexing strictly**: Use `Record<string, unknown>` rather than `any` for arbitrary dictionary objects.

### 3. Entity Domain Typings
Always import and use the dedicated interfaces from `src/types/world.ts` or `src/state.ts` when referring to core space objects:
- **`System`**: A galaxy sector containing planets, stations, enemies, and asteroids.
- **`Enemy`**: An NPC actor (hostile, friendly, or neutral).
- **`Asteroid`**: A mineable mineral deposit.
- **`Station`**: A dockable orbital facility.
- **`WreckPiece`**: Debris created when a ship is destroyed.
- **`SalvagePickup`**: Proximity-collected cargo or credits.
- **`ModuleDef`**: Immutable configuration for a ship module catalog entry.
- **`ModuleInstance`**: An instantiated module instance in a container or slot with durability and affixes.

### 4. Verification Checklists
- Before concluding a code change, always run:
  ```bash
  npm run typecheck
  npm run test:run
  ```
- Make sure both the compiler type checker and the unit test suite complete with zero errors.
