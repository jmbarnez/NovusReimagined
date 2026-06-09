import { type Player } from "../../state.js";
import { dst } from "../../utils/math.js";
import { getState } from "../../state-access.js";
import { ORE } from "../../data/resources.js";
import { flattenStorageMaterials } from "../../refinery/index.js";
import { TUTORIAL_TRAINING_SITE_ID } from "./site.js";
import type { TutorialZone } from "../types.js";

export function totalOre(p: Player): number {
  const pureOre = Object.keys(ORE).reduce((sum, key) => sum + (p.ore[key] || 0), 0);
  const mixedOre = (p.mixedOreCargo ?? []).reduce((sum, slot) => sum + slot.qty, 0);
  return pureOre + mixedOre;
}

export function hasLockOnAsteroid(p: Player): boolean {
  if (p.targetLock?.id?.startsWith("ast-")) return true;
  return p.lockQueue.some((s) => s.id.startsWith("ast-"));
}

function enemyInZone(e: { x: number; y: number; radius?: number }, zone: TutorialZone): boolean {
  return dst(e.x, e.y, zone.x, zone.y) < zone.r + (e.radius || 20);
}

export function countAliveTargetDummiesInZone(zone: TutorialZone, p: Player): number {
  const sys = getState().GALAXY[p.sysIdx];
  if (!sys) return 0;
  return sys.enemies.filter((e) =>
    e.type === "target_dummy" && e.alive && enemyInZone(e, zone),
  ).length;
}

export function getTrainingSite() {
  return getState().GALAXY[0]?.hiddenSites?.find((entry) => entry.id === TUTORIAL_TRAINING_SITE_ID) ?? null;
}

export function isTrainingSiteResolved(p: Player): boolean {
  if (p.scannedSiteIds.includes(TUTORIAL_TRAINING_SITE_ID)) return true;
  const site = getTrainingSite();
  return site?.state === "resolved" || site?.state === "cleared";
}

export function isTrainingSiteComplete(p: Player): boolean {
  return p.completedSiteIds.includes(TUTORIAL_TRAINING_SITE_ID);
}

export function isModuleFitted(baseId: string, rack: "turret" | "high" | "med" | "low", p: Player): boolean {
  for (const uid of p.fitting?.[rack] ?? []) {
    if (!uid) continue;
    const inst = p.moduleCargo.find((item) => item.uid === uid);
    if (inst?.baseId === baseId) return true;
  }
  return false;
}

export function hasCombatLoadout(p: Player): boolean {
  return isModuleFitted("tu-civilian-cannon", "high", p)
    && isModuleFitted("tu-civilian-salvager", "high", p);
}

// --- Cumulative Progression Bypass Helpers ---

export function hasBypassedMining(p: Player): boolean {
  const hasBulkMaterial = (p.bulkMaterialsCargo?.length ?? 0) > 0;
  const hasRefineryProgress = (p.hubQueue?.length ?? 0) > 0 || flattenStorageMaterials(p.refineryStorage).length > 0 || (p.hubOutput.materials?.length ?? 0) > 0;
  return totalOre(p) > 0
    || hasBulkMaterial
    || hasRefineryProgress
    || p.craftQueue.length > 0
    || hasCombatLoadout(p)
    || p.kills > 0
    || p.sysIdx !== 0;
}

export function hasBypassedIndustry(p: Player): boolean {
  const hasBulkMaterial = (p.bulkMaterialsCargo?.length ?? 0) > 0;
  const hasRefineryProgress = (p.hubQueue?.length ?? 0) > 0 || flattenStorageMaterials(p.refineryStorage).length > 0 || (p.hubOutput.materials?.length ?? 0) > 0;
  return hasBulkMaterial
    || hasRefineryProgress
    || p.craftQueue.length > 0
    || hasCombatLoadout(p)
    || p.kills > 0
    || p.sysIdx !== 0;
}

export function hasBypassedHangarTurrets(p: Player): boolean {
  return hasCombatLoadout(p)
    || p.kills > 0
    || p.sysIdx !== 0;
}

export function hasBypassedGunnery(p: Player): boolean {
  return p.kills > 0
    || p.sysIdx !== 0;
}
