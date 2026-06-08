import type { FontOption } from "./types.js";

/** Fonts the player can pick. Loaded via index.html. */
export const FONT_OPTIONS: FontOption[] = [
  { id: "Orbitron",       label: "Orbitron",     stack: "'Orbitron', sans-serif" },
  { id: "Rajdhani",       label: "Rajdhani",     stack: "'Rajdhani', sans-serif" },
  { id: "Exo 2",          label: "Exo 2",        stack: "'Exo 2', sans-serif" },
  { id: "Share Tech Mono",label: "Tech Mono",    stack: "'Share Tech Mono', monospace" },
  { id: "system-ui",      label: "System",       stack: "system-ui, sans-serif" },
];

export function getFontStack(id: string): string {
  return (FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0]).stack;
}
