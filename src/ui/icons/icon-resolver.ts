import { MODULES } from "../../data/modules.js";
import { ORE, LOOT, COMPONENTS } from "../../data/resources.js";
import type { IconPainter } from "./painters/shared.js";
import { RACK_COLORS } from "./painters/shared.js";
import { RESOURCE_PAINTERS } from "./painters/resources.js";
import { MODULE_PAINTERS, resolveModuleFamily, type ModuleFamily } from "./painters/modules.js";
import atlasManifest from "../../data/icon-atlas.manifest.json";

export type IconResolveKind = "exact" | "module-family" | "rack-fallback" | "category-fallback";

export interface ResolvedIcon {
  painter: IconPainter;
  accent: string;
  secondary?: string;
  isCivilian: boolean;
  family: string;
  kind: IconResolveKind;
}

function isCivilianId(id: string): boolean {
  return id.includes("civilian");
}

function rackAccent(rack: keyof typeof RACK_COLORS): string {
  return RACK_COLORS[rack];
}

function resolveResource(id: string): ResolvedIcon | null {
  if (ORE[id]) {
    return {
      painter: RESOURCE_PAINTERS[id] ?? RESOURCE_PAINTERS.__ore!,
      accent: ORE[id].color,
      isCivilian: false,
      family: id,
      kind: RESOURCE_PAINTERS[id] ? "exact" : "category-fallback",
    };
  }
  if (LOOT[id]) {
    return {
      painter: RESOURCE_PAINTERS[id] ?? RESOURCE_PAINTERS.__loot!,
      accent: LOOT[id].color,
      isCivilian: false,
      family: id,
      kind: RESOURCE_PAINTERS[id] ? "exact" : "category-fallback",
    };
  }
  if (COMPONENTS[id]) {
    return {
      painter: RESOURCE_PAINTERS[id] ?? RESOURCE_PAINTERS.__component!,
      accent: COMPONENTS[id].color,
      isCivilian: false,
      family: id,
      kind: RESOURCE_PAINTERS[id] ? "exact" : "category-fallback",
    };
  }
  if (id === "ammo-hybrid" || id === "ammo-missile") {
    return {
      painter: RESOURCE_PAINTERS[id]!,
      accent: "#a86838",
      isCivilian: false,
      family: id,
      kind: "exact",
    };
  }
  return null;
}

function resolveModule(id: string): ResolvedIcon {
  const mod = MODULES[id];
  const family = resolveModuleFamily(id);
  const painter = MODULE_PAINTERS[family] ?? MODULE_PAINTERS["__rack-turret"]!;
  const rack = mod?.rack ?? "turret";
  const accent = rackAccent(rack as keyof typeof RACK_COLORS);
  const isRackFallback = family.startsWith("__rack-");
  return {
    painter,
    accent,
    isCivilian: isCivilianId(id),
    family,
    kind: isRackFallback ? "rack-fallback" : "module-family",
  };
}

/** Resolve any item/module/resource id to a painter and palette. */
export function resolveIcon(id: string): ResolvedIcon {
  const resource = resolveResource(id);
  if (resource) return resource;

  if (MODULES[id]) return resolveModule(id);

  if (id.startsWith("ammo-")) {
    return {
      painter: RESOURCE_PAINTERS.__ammo!,
      accent: "#a86838",
      isCivilian: false,
      family: "__ammo",
      kind: "category-fallback",
    };
  }

  return {
    painter: RESOURCE_PAINTERS.__ore!,
    accent: "#5a8098",
    isCivilian: false,
    family: "__unknown",
    kind: "category-fallback",
  };
}

/** For tests: expected non-fallback family for each catalog id. */
export const EXPECTED_MODULE_FAMILIES: Record<string, ModuleFamily> = {
  "tu-civilian-cannon": "dual-rail",
  "tu-civilian-miner": "miner",
  "tu-civilian-neutron": "dual-rail",
  "tu-civilian-ion": "beam",
  "tu-civilian-gauss": "gauss",
  "tu-civilian-missile": "missile",
  "tu-civilian-pulse": "beam",
  "tu-cannon": "dual-rail",
  "tu-neutron": "dual-rail",
  "tu-ion": "beam",
  "tu-gauss": "gauss",
  "tu-missile": "missile",
  "tu-strip": "strip",
  "tu-pulse": "beam",
  "hi-cruise": "cruise",
  "hi-nos": "nos",
  "tu-civilian-salvager": "salvager",
  "hi-salv": "hi-salv",
  "tu-tractor": "tractor",
  "hi-comms": "comms",
  "hi-link": "link",
  "tu-civilian-scanner": "scanner",
  "hi-scanner-array": "scanner-array",
  "hi-cipher-analyzer": "cipher",
  "me-ab1": "ab",
  "me-mwd": "mwd",
  "me-shield": "shield",
  "me-cap": "capacitor",
  "me-signal-amplifier": "signal",
  "me-spectrum-filter": "signal",
  "me-noise-injector": "signal",
  "me-tract": "med-tract",
  "lo-gyro": "gyro",
  "lo-dcu": "dcu",
  "lo-battery": "battery",
  "lo-nano": "nano",
  "lo-data-recovery-suite": "data-recovery",
  "lo-hull": "hull",
  "lo-deadspace": "deadspace",
  "tu-npc-sentry-cannon": "sentry",
  "tu-npc-mite-laser": "mite",
};

export function allIconCatalogIds(): string[] {
  const ids = [
    ...Object.keys(ORE),
    ...Object.keys(LOOT),
    ...Object.keys(COMPONENTS),
    "ammo-hybrid",
    "ammo-missile",
    ...Object.keys(MODULES),
  ];
  const manifestIds = Object.keys((atlasManifest as { frames?: Record<string, unknown> }).frames ?? {});
  return Array.from(new Set([...ids, ...manifestIds]));
}
