# Star Sonata — Developer Guide

## Core Documentation
- **[Architecture & Conventions](docs/architecture.md)** — State management rules, Event bus, Key patterns, and Adding new content.
- **[Developer To-Do List](docs/todo.md)** — Architectural debt tracker and a list of resolved debt items.

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
