import { Client } from "../state.js";

/**
 * Active UI font family name, for canvas/Pixi text that can't read CSS vars.
 * Mirrors the player's font choice so world-space labels match the DOM HUD.
 */
export function getUIFont(): string {
  return Client.settings?.fontFamily || "Orbitron";
}
