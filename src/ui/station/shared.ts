import { MODULES, ModuleDef } from "../../data/modules.js";
import type { MissionContract } from "../../data/missions.js";
import type { CraftJob } from "../../data/industryRecipes.js";
import { ORE } from "../../data/resources.js";
import { ALLOY_FAMILIES } from "../../refinery/index.js";
import type { RefiningHeatMode } from "../../state.js";

export const stationState = {
  previewFitting: null as Record<string, (string | null)[]> | null,
  _stationMissions: [] as MissionContract[],
  activeTab: "hangar" as "hangar" | "market" | "industry" | "fabrication" | "missions",
  mktTab: "modules",
  mktRack: "all",
  mktSearch: "",
  mktSort: "name",
  indStage: "process" as "process" | "separate" | "alloy",
  indRailTab: "queue" as "hold" | "dossier" | "queue" | "output",
  indRailPulseTab: null as "hold" | "dossier" | "queue" | "output" | null,
  indRailPulseUntil: 0 as number,
  indTab: "workbench",
  indSearch: "",
  indSort: "name",
  indHeatOverrides: {} as Record<string, RefiningHeatMode>,
  indProcessSource: null as string | null,
  indProcessQty: {} as Record<string, number>,
  indProcessTarget: {} as Record<string, string>,
  indSeparateSource: null as string | null,
  indAlloyTargetStorage: {} as Record<string, string>,
  indAlloySelections: {} as Record<string, string[]>,
  indAlloyShowMore: {} as Record<string, boolean>,
  selectedRecipeId: null as string | null,
  craftQueue: [] as CraftJob[],
  craftQty: 1 as number,
};

export const MAX_ACTIVE_CONTRACTS = 3;

export const CONTRACT_TYPE_ICONS: Record<string, string> = {
  bounty: "⌖", mining: "⛏", delivery: "▲", salvage: "◈",
};

export const EFF_LABEL: Record<string, (v: number) => string> = {
  weaponMultBonus:     v => `wpn +${(v*100).toFixed(0)}%`,
  miningMultBonus:     v => `mine +${(v*100).toFixed(0)}%`,
  hullEhpMultBonus:    v => `hull +${(v*100).toFixed(0)}%`,
  addPowergrid:        v => `PG +${v}`,
  mainEngineMN:        v => `engine +${v}MN`,
  simThrustPctBonus:   v => `thrust +${(v*100).toFixed(0)}%`,
  simMaxSpeedPctBonus: v => `speed +${(v*100).toFixed(0)}%`,
  simTurnPctBonus:     v => `turn +${(v*100).toFixed(0)}%`,
  capacitorFlat:       v => `cap +${v}`,
  capacitorPctBonus:   v => `cap +${(v*100).toFixed(0)}%`,
  capRechargePctBonus: v => `cap regen +${(v*100).toFixed(0)}%`,
  shieldRegenFlat:     v => `shld regen +${v}/s`,
  evasionMultBonus:    v => `evasion +${(v*100).toFixed(0)}%`,
  miningRangePctBonus: v => `mine range +${(v*100).toFixed(0)}%`,
  miningRangeKmBonus:  v => `mine range +${v}km`,
  lockScanBonus:       v => `scan +${(v*100).toFixed(0)}%`,
  structuralMassMult:  v => `mass ×${v.toFixed(2)}`,
};

export function fmtModBonuses(m: ModuleDef): string {
  const parts: string[] = [];
  if (m.weaponDelivery && m.damageProfile) {
    const dmg = Object.entries(m.damageProfile as Record<string,number>)
      .filter(([,v]) => v).map(([t,v]) => `${v}${t.slice(0,3).toUpperCase()}`).join("+");
    if (dmg) parts.push(`DMG ${dmg}`);
    if (m.optimalRange) parts.push(`rng ${m.optimalRange}${m.falloff ? `+${m.falloff}` : ""}km`);
    if (m.trackingSpeed != null) parts.push(`trk ${Math.round(m.trackingSpeed*100)}%`);
  }
  if (m.mining) {
    parts.push("mining laser");
    if (m.optimalRange) {
      parts.push(`rng ${m.optimalRange}m`);
    }
  }
  if (m.isSalvager) parts.push(`salvager +${((m.salvageRollBonus||0)*100).toFixed(0)}%`);
  for (const [k, v] of Object.entries(m.effects || {})) {
    if (v && EFF_LABEL[k]) parts.push(EFF_LABEL[k](v as number));
  }
  return parts.join(" · ");
}

export function iconSvg(id: string, size = 24): string {
  const rackColor: Record<string, string> = {
    turret: "#b07038", high: "#8068b0", med: "#3888a8", low: "#589858",
  };
  const catColor: Record<string, string> = {
    ore: "#5a8878", loot: "#8a7848", comp: "#508878", ammo: "#a86838", material: "#b48a52",
  };
  const mod = MODULES[id];
  let color = "#5a8098";
  if (mod) color = rackColor[mod.rack] || color;
  else if (ORE[id]) color = catColor.ore;
  else if (ALLOY_FAMILIES.some((family) => family.id === id)) color = catColor.material;
  else if (["scrap","chip","cell"].includes(id)) color = catColor.loot;
  else if (["circuit","gear","harness","sensor_cluster"].includes(id)) color = catColor.comp;
  else if (["ammo-hybrid","ammo-missile"].includes(id)) color = catColor.ammo;

  const S: Record<string, string> = {
    "tu-cannon":    `<rect x="8" y="10" width="13" height="4"/><rect x="2" y="8" width="8" height="8"/>`,
    "tu-neutron":   `<rect x="9" y="11" width="10" height="3"/><rect x="2" y="8" width="8" height="8"/>`,
    "tu-ion":       `<polygon points="2,8 10,12 2,16"/><line x1="10" y1="12" x2="22" y2="12"/>`,
    "tu-gauss":     `<rect x="5" y="10" width="17" height="4"/><rect x="2" y="7" width="5" height="10"/>`,
    "tu-missile":   `<path d="M4,10 L4,14 L14,14 L20,12 L14,10 Z"/><line x1="2" y1="10" x2="4" y2="10"/><line x1="2" y1="14" x2="4" y2="14"/>`,
    "tu-strip":     `<line x1="2" y1="5" x2="18" y2="12"/><line x1="2" y1="19" x2="18" y2="12"/><circle cx="18" cy="12" r="2"/>`,
    "tu-pulse":     `<path d="M2,9 L9,12 L2,15"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="20" cy="12" r="2"/>`,
    "hi-cruise":    `<rect x="9" y="5" width="6" height="13"/><path d="M9,5 L12,2 L15,5"/><line x1="8" y1="18" x2="6" y2="22"/><line x1="16" y1="18" x2="18" y2="22"/>`,
    "hi-nos":       `<circle cx="12" cy="12" r="7"/><path d="M12,5 A7,7 0 0,1 19,12" stroke-dasharray="2,1.5"/><circle cx="12" cy="12" r="2"/>`,
    "hi-salv":      `<path d="M8,7 L8,15 L5,19"/><path d="M12,5 L12,19"/><path d="M16,7 L16,15 L19,19"/><line x1="8" y1="7" x2="16" y2="7"/>`,
    "hi-link":      `<line x1="12" y1="20" x2="12" y2="9"/><line x1="12" y1="9" x2="8" y2="5"/><line x1="12" y1="9" x2="16" y2="5"/><path d="M6,15 A7,4 0 0,1 18,15" stroke-dasharray="2,1"/>`,
    "me-ab1":       `<path d="M16,8 L22,12 L16,16"/><rect x="4" y="9" width="12" height="6"/><line x1="2" y1="10" x2="4" y2="10"/><line x1="2" y1="14" x2="4" y2="14"/>`,
    "me-mwd":       `<path d="M14,6 L22,12 L14,18"/><path d="M10,8 L16,12 L10,16"/><rect x="2" y="10" width="10" height="4"/>`,
    "me-shield":    `<path d="M12,3 L20,7 L20,15 Q20,21 12,22 Q4,21 4,15 L4,7 Z"/>`,
    "me-cap":       `<path d="M12,4 A8,8 0 0,1 20,12 A8,8 0 0,1 12,20"/><circle cx="12" cy="12" r="3"/>`,
    "me-tract":     `<path d="M4,20 L12,6 L20,20 Z"/><circle cx="12" cy="6" r="2"/><line x1="4" y1="22" x2="20" y2="22"/>`,
    "lo-gyro":      `<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><circle cx="12" cy="12" r="2"/>`,
    "lo-dcu":       `<rect x="4" y="6" width="16" height="3"/><rect x="4" y="11" width="16" height="3"/><rect x="4" y="16" width="16" height="3"/>`,
    "lo-battery":   `<rect x="5" y="7" width="14" height="12" rx="2"/><line x1="9" y1="5" x2="15" y2="5"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="9" y1="9" x2="15" y2="9"/>`,
    "lo-nano":      `<circle cx="12" cy="12" r="2"/><circle cx="6" cy="8" r="1.5"/><circle cx="18" cy="8" r="1.5"/><circle cx="6" cy="16" r="1.5"/><circle cx="18" cy="16" r="1.5"/><line x1="6" y1="8" x2="12" y2="12"/><line x1="18" y1="8" x2="12" y2="12"/><line x1="6" y1="16" x2="12" y2="12"/><line x1="18" y1="16" x2="12" y2="12"/>`,
    "lo-hull":      `<rect x="3" y="8" width="18" height="8"/><line x1="3" y1="11" x2="21" y2="11"/><line x1="3" y1="13" x2="21" y2="13"/>`,
    "lo-deadspace": `<polygon points="12,3 20,8 20,16 12,21 4,16 4,8"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="0.75"/><line x1="4" y1="8" x2="20" y2="16" stroke-width="0.75"/><line x1="20" y1="8" x2="4" y2="16" stroke-width="0.75"/>`,
    "iron":         `<polygon points="6,19 3,12 6,5 12,3 18,5 21,12 18,19 12,21"/>`,
    "crystal":      `<polygon points="12,2 19,9 16,22 8,22 5,9"/><line x1="12" y1="2" x2="12" y2="22" stroke-width="0.75"/>`,
    "exotic":       `<circle cx="12" cy="12" r="5"/><circle cx="12" cy="3" r="1.5"/><circle cx="21" cy="12" r="1.5"/><circle cx="12" cy="21" r="1.5"/><circle cx="3" cy="12" r="1.5"/>`,
    "scrap":        `<path d="M5,9 L10,4 L14,6 L19,4 L20,10 L15,12 L18,19 L12,21 L8,19 L4,14 Z"/><line x1="9" y1="8" x2="16" y2="16" stroke-width="0.75"/>`,
    "chip":         `<rect x="5" y="7" width="14" height="10" rx="1"/><line x1="5" y1="10" x2="2" y2="10"/><line x1="5" y1="12" x2="2" y2="12"/><line x1="5" y1="14" x2="2" y2="14"/><line x1="19" y1="10" x2="22" y2="10"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="19" y1="14" x2="22" y2="14"/><line x1="9" y1="7" x2="9" y2="4"/><line x1="15" y1="7" x2="15" y2="4"/>`,
    "cell":         `<rect x="7" y="6" width="10" height="14" rx="2"/><line x1="10" y1="4" x2="14" y2="4"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="14" x2="15" y2="14"/>`,
    "circuit":        `<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8,5 L8,9 L12,9 L12,5"/><path d="M16,19 L16,15 L12,15 L12,19"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/>`,
    "gear":           `<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3,2.3"/>`,
    "harness":        `<path d="M3,8 Q12,5 21,8"/><path d="M3,12 Q12,9 21,12"/><path d="M3,16 Q12,13 21,16"/><line x1="3" y1="8" x2="3" y2="16"/><line x1="21" y1="8" x2="21" y2="16"/>`,
    "sensor_cluster": `<path d="M4,21 L12,6 L20,21"/><circle cx="12" cy="6" r="2"/><path d="M7,15 A6,6 0 0,1 17,15" stroke-dasharray="1.5,1"/>`,
    "ammo-hybrid":  `<rect x="9" y="5" width="6" height="14" rx="3"/><path d="M9,5 Q9,3 12,3 Q15,3 15,5"/>`,
    "ammo-missile": `<path d="M7,12 L11,6 L17,6 L20,12 L17,18 L11,18 Z"/><line x1="7" y1="12" x2="3" y2="12"/><line x1="11" y1="18" x2="9" y2="22"/><line x1="17" y1="18" x2="19" y2="22"/>`,
  };

  const sh = S[id] || `<circle cx="12" cy="12" r="8"/>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${sh}</svg>`;
}
