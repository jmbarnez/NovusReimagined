# verify-checklist — Build & Test Verification Steps

## When to invoke

Call this skill **before concluding any code change** that touches TypeScript source files, adds dependencies, modifies build config, or introduces new logic.

## Verification Steps

Run these commands in order and do not consider the task complete until both pass with zero errors:

```bash
npm run typecheck   # tsc --noEmit — catches compile-time type errors
npm run test:run    # Vitest single run — catches regressions
```

If either command fails:
1. Fix the underlying issue, not the symptom.
2. Re-run both commands.
3. Repeat until clean.

## Why both?

- **`npm run typecheck`** catches type-level bugs that tests might miss (e.g., incorrect interface usage, missing properties).
- **`npm run test:run`** catches runtime logic errors and regressions that the type checker can't see.

Skipping either step risks committing broken code.

## Quick reference: other useful commands

```bash
npm run dev         # Start dev server with hot reload
npm run build       # Production build → dist/
npm run preview     # Preview production build
npm run check       # Build to catch type/syntax errors (alias: vite build)
npm run test        # Vitest watch mode
npm run lint        # Linter (currently a no-op placeholder)
```
