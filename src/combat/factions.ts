export type Faction = "hostile" | "neutral" | "player";

/**
 * Determines if two factions are hostile to each other.
 * - player vs hostile = hostile
 * - neutral vs hostile = hostile
 * - neutral vs player = friendly (not hostile)
 * - player vs player, hostile vs hostile, neutral vs neutral = friendly
 */
export function isHostile(a?: Faction | string | null, b?: Faction | string | null): boolean {
  const fA = a || "hostile"; // Defaults to hostile if absent
  const fB = b || "hostile";
  
  if (fA === "hostile" && fB !== "hostile") return true;
  if (fB === "hostile" && fA !== "hostile") return true;
  return false;
}
