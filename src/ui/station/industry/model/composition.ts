import { getState } from "../../../../state-access.js";
import { getAlloyFamilies, assessAlloyFamilies } from "../../../../refinery/index.js";
import { poolItemLabel } from "../../../../data/industryRecipes.js";
import { escHtml } from "../../../../utils/format.js";
import { oreColor } from "./formatting.js";
import { refineryMaterials } from "./state.js";

export interface GroupedRefineryMaterial {
  key: string;
  label: string;
  purpose: string;
  kind: "processed" | "alloy" | "customBlend";
  count: number;
  volumeM3: number;
  massKg: number;
  composition: Record<string, number>;
  sourceIds: string[];
  representativeId: string;
  compatibleFamilyIds: string[];
  tags: string[];
}

export interface BlendPreview {
  composition: Record<string, number>;
  massKg: number;
  volumeM3: number;
  familyMatches: ReturnType<typeof assessAlloyFamilies>;
  discoveryMatch: {
    label: string;
    purpose: string;
    tags: string[];
    fitPct: number;
  } | null;
  compatibleFamilyIds: string[];
}

export function dominantOreKey(composition: Record<string, number>): string | null {
  const entries = Object.entries(composition).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function compositionGradient(composition: Record<string, number>): string {
  const entries = Object.entries(composition)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value > 0.03);
  if (!entries.length) return "linear-gradient(90deg, #4a5a66, #6a7a86)";
  let cursor = 0;
  const stops: string[] = [];
  for (const [oreKey, value] of entries) {
    const pct = Math.max(4, Math.round(value * 100));
    const start = cursor;
    const end = Math.min(100, cursor + pct);
    const color = oreColor(oreKey);
    stops.push(`${color} ${start}% ${end}%`);
    cursor = end;
  }
  if (cursor < 100) stops.push(`rgba(255,255,255,0.12) ${cursor}% 100%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function compositionAccentVars(composition: Record<string, number>): string {
  const dominantKey = dominantOreKey(composition);
  const accent = dominantKey ? oreColor(dominantKey) : "#b48a52";
  return `--ind-accent:${accent};--ind-comp-gradient:${compositionGradient(composition)};`;
}

export function groupRefineryMaterials(kind?: GroupedRefineryMaterial["kind"]): GroupedRefineryMaterial[] {
  const grouped = new Map<string, GroupedRefineryMaterial>();
  for (const stack of refineryMaterials()) {
    if (kind && stack.kind !== kind) continue;
    const key = `${stack.kind}|${stack.alloyFamilyId ?? stack.materialId}|${JSON.stringify(stack.composition)}`;
    const family = getAlloyFamilies().find((entry) => entry.id === (stack.alloyFamilyId ?? stack.materialId));
    const discovery = getState().player.alloyCodex?.discoveries.find((entry) => entry.id === (stack.alloyFamilyId ?? stack.materialId));
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.volumeM3 += stack.volumeM3;
      existing.massKg += stack.massKg;
      existing.sourceIds.push(stack.id);
      continue;
    }
    grouped.set(key, {
      key,
      label: discovery?.label ?? stack.label,
      purpose: discovery?.purpose ?? family?.purpose ?? stack.kind,
      kind: stack.kind,
      count: 1,
      volumeM3: stack.volumeM3,
      massKg: stack.massKg,
      composition: { ...stack.composition },
      sourceIds: [stack.id],
      representativeId: stack.id,
      compatibleFamilyIds: discovery?.compatibleFamilyIds ?? (family ? [family.id] : []),
      tags: discovery?.tags ?? family?.tags ?? [],
    });
  }
  return [...grouped.values()].sort((a, b) => b.volumeM3 - a.volumeM3 || a.label.localeCompare(b.label));
}

export function buildBlendPreview(materials: GroupedRefineryMaterial[]): BlendPreview {
  const totalMassKg = materials.reduce((sum, entry) => sum + entry.massKg, 0);
  const totalVolumeM3 = materials.reduce((sum, entry) => sum + entry.volumeM3, 0);
  const weighted: Record<string, number> = {};
  if (totalMassKg > 0) {
    for (const material of materials) {
      for (const [oreKey, fraction] of Object.entries(material.composition)) {
        weighted[oreKey] = (weighted[oreKey] ?? 0) + (fraction * material.massKg);
      }
    }
  }
  const composition = totalMassKg > 0
    ? Object.fromEntries(
      Object.entries(weighted)
        .map(([oreKey, value]): [string, number] => [oreKey, value / totalMassKg])
        .filter(([, value]) => value > 0.0001),
    )
    : { iron: 1 };
  const familyMatches = assessAlloyFamilies(composition, 0.06);
  const codex = getState().player.alloyCodex;
  const discoveryMatch = (codex?.discoveries ?? [])
    .map((entry) => {
      let diff = 0;
      const keys = new Set([...Object.keys(entry.composition), ...Object.keys(composition)]);
      for (const key of keys) diff += Math.abs((entry.composition[key] ?? 0) - (composition[key] ?? 0));
      const fitPct = Math.max(0, 100 - diff * 120);
      return {
        label: entry.label,
        purpose: entry.purpose,
        tags: entry.tags ?? [],
        fitPct,
      };
    })
    .filter((entry) => entry.fitPct >= 55)
    .sort((a, b) => b.fitPct - a.fitPct || a.label.localeCompare(b.label))[0] ?? null;
  const compatibleFamilyIds = new Set<string>();
  for (const material of materials) {
    for (const familyId of material.compatibleFamilyIds) compatibleFamilyIds.add(familyId);
  }
  return {
    composition,
    massKg: totalMassKg,
    volumeM3: totalVolumeM3,
    familyMatches,
    discoveryMatch,
    compatibleFamilyIds: [...compatibleFamilyIds],
  };
}

export function renderCompositionBars(composition: Record<string, number>): string {
  const entries = Object.entries(composition)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value > 0.03);
  return `
    <div class="ind-comp-bars">
      ${entries.map(([key, value]) => `
        <div class="ind-comp-row">
          <div class="ind-comp-row-head">
            <span>${escHtml(poolItemLabel("ore", key))}</span>
            <span>${Math.round(value * 100)}%</span>
          </div>
          <div class="ind-comp-track"><div class="ind-comp-fill" style="width:${Math.max(6, value * 100)}%;background:${oreColor(key)}"></div></div>
        </div>
      `).join("")}
    </div>
  `;
}

export function renderCompositionRibbon(
  segments: Array<{
    label: string;
    composition: Record<string, number>;
    meta: string;
    tone?: "source" | "result" | "blend";
  }>,
): string {
  return `
    <div class="ind-comp-ribbon">
      ${segments.map((segment, index) => `
        <div class="ind-comp-ribbon-block ind-comp-ribbon-block--${segment.tone ?? "source"}" style="${compositionAccentVars(segment.composition)}">
          <div class="ind-comp-ribbon-head">
            <span>${escHtml(segment.label)}</span>
            <small>${escHtml(segment.meta)}</small>
          </div>
          <div class="ind-comp-ribbon-track">
            <div class="ind-comp-ribbon-fill" style="background:${compositionGradient(segment.composition)}"></div>
          </div>
        </div>
        ${index < segments.length - 1 ? `<div class="ind-comp-ribbon-arrow">→</div>` : ""}
      `).join("")}
    </div>
  `;
}
