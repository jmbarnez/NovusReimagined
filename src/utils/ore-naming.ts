import { ORE } from "../data/resources.js";

export const ORE_KEYS = ["iron", "nickel", "silicate", "carbon", "crystal", "exotic"] as const;

export type OreKey = (typeof ORE_KEYS)[number];
export type OreComposition = Record<string, number>;

const PREFIX: Record<OreKey, string> = {
  iron: "Ferro",
  nickel: "nickel",
  silicate: "silicate",
  carbon: "carbonaceous",
  crystal: "crystalline",
  exotic: "exotic",
};

const SINGLE_PREFIX: Record<OreKey, string> = {
  iron: "Ferro",
  nickel: "Nickel",
  silicate: "Siliceous",
  carbon: "Carbonaceous",
  crystal: "Crystalline",
  exotic: "Exotic",
};

const NOUNS: Record<OreKey, string> = {
  iron: "chunk",
  nickel: "chunk",
  silicate: "chunk",
  carbon: "chunk",
  crystal: "chunk",
  exotic: "chunk",
};

export function normalizeComposition(composition: OreComposition): OreComposition {
  const positiveEntries = Object.entries(composition).filter(([, value]) => value > 0);
  const total = positiveEntries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return { iron: 1 };
  const normalized: OreComposition = {};
  for (const [key, value] of positiveEntries) {
    normalized[key] = value / total;
  }
  return normalized;
}

export function sortedCompositionEntries(composition: OreComposition): [string, number][] {
  return Object.entries(normalizeComposition(composition))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function dominantOreKey(composition: OreComposition): string {
  return sortedCompositionEntries(composition)[0]?.[0] ?? "iron";
}

export function oreColorForComposition(composition: OreComposition): string {
  const key = dominantOreKey(composition);
  return ORE[key]?.color ?? ORE.iron.color;
}

function prefixFor(key: string): string {
  return PREFIX[key as OreKey] ?? key;
}

function singlePrefixFor(key: string): string {
  return SINGLE_PREFIX[key as OreKey] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function nounFor(key: string): string {
  return NOUNS[key as OreKey] ?? "aggregate";
}

export function generateOreName(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const [firstKey, firstFraction] = sorted[0] ?? ["iron", 1];
  const [secondKey, secondFraction] = sorted[1] ?? ["", 0];
  const noun = nounFor(firstKey);

  if (firstFraction >= 0.85 || sorted.length === 1) {
    return `${singlePrefixFor(firstKey)} ${noun}`;
  }

  if (secondKey && firstFraction >= 0.15 && secondFraction >= 0.15 && sorted.length === 2) {
    return `${prefixFor(firstKey)}-${prefixFor(secondKey)} ${noun}`;
  }

  if (secondKey && sorted.length >= 3 && firstFraction >= 0.45) {
    return `${singlePrefixFor(firstKey)}-rich mixed chunk`;
  }

  if (secondKey) {
    return `${prefixFor(firstKey)}-${prefixFor(secondKey)} chunk`;
  }

  return `${singlePrefixFor(firstKey)} ${noun}`;
}

export function formatCompositionBreakdown(composition: OreComposition): string {
  return sortedCompositionEntries(composition)
    .map(([key, fraction]) => `${ORE[key]?.abbr ?? key} ${Math.round(fraction * 100)}%`)
    .join(" / ");
}
