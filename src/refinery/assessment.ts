import { ORE } from "../data/resources.js";
import type { AlloyCodex, DiscoveredAlloy, RefiningHeatMode } from "../state.js";
import { normalizeComposition, sortedCompositionEntries, type OreComposition } from "../utils/ore-naming.js";
import { ALLOY_FAMILIES, type AlloyFamily } from "./families.js";
import { averageDensityKgPerM3, discoverySignatureKey } from "./composition.js";

function dominantPurposeTag(composition: OreComposition): string[] {
  const assessments = assessAlloyFamilies(composition, 0.04)
    .filter((entry) => entry.score != null && entry.fitPct >= 54)
    .slice(0, 2);
  const tags = new Set<string>();
  for (const assessment of assessments) {
    for (const tag of assessment.family.tags ?? []) tags.add(tag);
  }
  return tags.size ? [...tags] : ["experimental"];
}

function discoveredAlloyLabel(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const first = sorted[0]?.[0] ?? "iron";
  const second = sorted[1]?.[0] ?? "carbon";
  return `${ORE[first]?.abbr ?? first}-${ORE[second]?.abbr ?? second} intermediate`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function createDiscoveredAlloy(composition: OreComposition, discoveredAt: number): DiscoveredAlloy {
  const normalized = normalizeComposition(composition);
  const compatibleFamilies = assessAlloyFamilies(normalized, 0.04)
    .filter((entry) => entry.score != null && entry.fitPct >= 52)
    .slice(0, 2)
    .map((entry) => entry.family.id);
  const tags = dominantPurposeTag(normalized);
  return {
    id: `disc-${Math.abs(hashString(discoverySignatureKey(normalized))).toString(36)}`,
    label: discoveredAlloyLabel(normalized),
    signatureKey: discoverySignatureKey(normalized),
    composition: normalized,
    densityKgPerM3: averageDensityKgPerM3(normalized) * 0.99,
    purpose: compatibleFamilies.length
      ? compatibleFamilies
        .map((familyId) => ALLOY_FAMILIES.find((family) => family.id === familyId)?.purpose)
        .filter((value): value is string => !!value)
        .join(" / ")
      : "Experimental systems stock",
    tags,
    compatibleFamilyIds: compatibleFamilies,
    discoveredAt,
    seenCount: 1,
  };
}

export function makeDefaultAlloyCodex(): AlloyCodex {
  return {
    knownFamilyIds: ALLOY_FAMILIES.map((family) => family.id),
    discoveries: [],
  };
}

function scoreAgainstFamily(composition: OreComposition, family: AlloyFamily, toleranceBonus: number): number | null {
  const normalized = normalizeComposition(composition);
  let score = 0;
  let totalTrace = 0;
  for (const [key, fraction] of Object.entries(normalized)) {
    const win = family.windows[key];
    if (!win) {
      totalTrace += fraction;
      score += fraction * 1.4;
      continue;
    }
    const min = Math.max(0, win.min - toleranceBonus);
    const max = Math.min(1, win.max + toleranceBonus);
    if (fraction < min) score += min - fraction;
    else if (fraction > max) score += fraction - max;
    if (fraction > win.max) totalTrace += Math.max(0, fraction - win.max);
  }
  if (family.traceLimit != null && totalTrace > family.traceLimit + toleranceBonus) return null;
  return score;
}

export interface AlloyFamilyAssessment {
  family: AlloyFamily;
  score: number | null;
  fitPct: number;
  tracePct: number;
  status: "match" | "near" | "off";
}

function traceOverrun(composition: OreComposition, family: AlloyFamily): number {
  const normalized = normalizeComposition(composition);
  let totalTrace = 0;
  for (const [key, fraction] of Object.entries(normalized)) {
    const win = family.windows[key];
    if (!win) {
      totalTrace += fraction;
      continue;
    }
    if (fraction > win.max) totalTrace += Math.max(0, fraction - win.max);
  }
  return totalTrace;
}

export function assessAlloyFamilies(
  composition: OreComposition,
  toleranceBonus: number,
): AlloyFamilyAssessment[] {
  return ALLOY_FAMILIES.map((family) => {
    const score = scoreAgainstFamily(composition, family, toleranceBonus);
    const tracePct = traceOverrun(composition, family);
    const fitPct = score == null
      ? Math.max(0, 60 - tracePct * 140)
      : Math.max(0, Math.min(100, 100 - score * 180));
    let status: AlloyFamilyAssessment["status"] = "off";
    if (score != null && fitPct >= 90) status = "match";
    else if (score != null && fitPct >= 68) status = "near";
    return {
      family,
      score,
      fitPct,
      tracePct,
      status,
    };
  }).sort((a, b) => {
    const aRank = a.status === "match" ? 0 : a.status === "near" ? 1 : 2;
    const bRank = b.status === "match" ? 0 : b.status === "near" ? 1 : 2;
    return aRank - bRank || b.fitPct - a.fitPct || a.family.label.localeCompare(b.family.label);
  });
}

export function resolveAlloyFamily(
  composition: OreComposition,
  targetFamilyId: string | null | undefined,
  toleranceBonus: number,
): AlloyFamily | null {
  if (targetFamilyId) {
    const target = ALLOY_FAMILIES.find((family) => family.id === targetFamilyId) ?? null;
    if (!target) return null;
    return scoreAgainstFamily(composition, target, toleranceBonus) == null ? null : target;
  }
  let best: AlloyFamily | null = null;
  let bestScore = Infinity;
  for (const family of ALLOY_FAMILIES) {
    const score = scoreAgainstFamily(composition, family, toleranceBonus);
    if (score == null) continue;
    if (score < bestScore) {
      best = family;
      bestScore = score;
    }
  }
  return best;
}

export function upsertDiscoveredAlloy(codex: AlloyCodex, composition: OreComposition, now: number): DiscoveredAlloy {
  const signature = discoverySignatureKey(composition);
  const existing = codex.discoveries.find((entry) => entry.signatureKey === signature);
  if (existing) {
    existing.seenCount += 1;
    return existing;
  }
  const created = createDiscoveredAlloy(composition, now);
  codex.discoveries.push(created);
  return created;
}
