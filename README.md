# Novus

A space simulation game built with TypeScript, PixiJS, and Tauri.

## Overview

Novus is a server-authoritative space simulation featuring real-time combat, mining, salvaging, and exploration. The game uses a modular architecture with strict state management boundaries to ensure clean separation between simulation, rendering, and UI.

## Tech Stack

- **TypeScript** — Type-safe game logic
- **PixiJS** — High-performance WebGL/WebGPU rendering
- **Tauri** — Desktop application framework
- **Vite** — Build tooling and dev server
- **Vitest** — Unit testing

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test:run

# Type checking
npm run typecheck
```

## Architecture

Novus follows a server-authoritative simulation model. All game state mutations go through dedicated accessors in `src/state-access.ts`, ensuring clean boundaries between systems.

Key architectural principles:
- **State immutability** — Replace rather than mutate
- **Event-driven communication** — Use the event bus for cross-module messaging
- **Modular state access** — All writes go through domain-specific accessors
- **Pixi-only rendering** — All in-game visuals go through PixiJS

## Documentation

- [Architecture Overview](docs/architecture.md) — State management, event bus, and system design
- [Developer Guide](AGENTS.md) — Coding standards and workflow guidelines
- [To-Do List](docs/todo.md) — Architectural debt tracker

## License

Private project.
