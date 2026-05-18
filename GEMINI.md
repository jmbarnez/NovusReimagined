# Novus Project Instructions

## Tech Stack
- **Build Tool:** Vite
- **Language:** TypeScript (Vanilla, no UI framework like React/Vue based on current structure)
- **Testing:** Vitest

## Architecture
- **State Management (`src/state.ts`):**
  - `G`: Authoritative game/simulation state. Data that belongs to the simulation, entities, players, physics.
  - `Client`: Client-only state. Inputs, UI states, camera, and display variables.

## Project Structure
- `src/` - Main source code.
  - `main.ts` - Entry point, initialization.
  - `state.ts` - Global state.
  - `canvas.ts` - Canvas rendering setup.
  - `game-loop.ts` - Core update and render loop.
  - `physics/` - Physics logic for ships, NPCs, combat.
  - `player/` - Player data, stats computation, and fitting.
  - `render/` - Rendering logic for different layers (background, HUD, world).
  - `ui/` - UI components (bridge, settings, HUD).
  - `data/` - Static game data definitions (ships, modules, skills, etc.).
  - `utils/` - Helpers (math, entities, spatial grid).

## Guidelines
- Keep logic cleanly separated between `G` (simulation) and `Client` (view/input).
- Add comments for non-obvious logic; don’t comment obvious code; don’t rewrite existing comments unless needed.
- Keep files small and the project modular.
- Proactively suggest improvements for code quality, architecture, performance, or maintainability when relevant opportunities arise.
- Stop making verification files and tests until said otherwise.
