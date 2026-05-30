import { makePlayer, validatePilotName } from "../player/player-data.js";
import { SHIPS } from "../data/ships.js";
import { RACK_TYPES } from "../constants.js";
import { resolvePlayerSpawn } from "../utils/player-spawn.js";
import { getHardpointRack } from "../utils/hardpoints.js";
import type { Player } from "../state.js";
import type { System } from "../types/world.js";
import type { ShipDef } from "../data/ships.js";

const MAX_ABS_COORD = 1_000_000;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function finiteNumber(value: number, fallback: number, min = -Infinity, max = Infinity): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function finiteInt(value: number, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.trunc(finiteNumber(value, fallback, min, max));
}

function cloneNumberRecord(value: Record<string, number>, fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const src = value && typeof value === "object" ? value : fallback;
  for (const [key, raw] of Object.entries(src)) {
    out[key] = finiteNumber(raw, fallback[key] ?? 0, 0);
  }
  return out;
}

function cloneBooleanRecord(value: Record<string, boolean>, fallback: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const src = value && typeof value === "object" ? value : fallback;
  for (const [key, raw] of Object.entries(src)) {
    out[key] = raw === true;
  }
  return out;
}

function cloneStringArray(value: string[] | undefined): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry) => typeof entry === "string"))] : [];
}

function cloneFitting(value: Player["fitting"], fallback: Player["fitting"], ship: ShipDef): Player["fitting"] {
  const out: Player["fitting"] = {};
  for (const rack of RACK_TYPES) {
    const n = ship.fitting[rack] ?? 0;
    const source = Array.isArray(value?.[rack]) ? value[rack] : fallback[rack] ?? [];
    out[rack] = Array.from({ length: n }, (_, idx) => {
      const uid = source[idx];
      return typeof uid === "string" ? uid : null;
    });
  }
  return out;
}

function zeroSlotTimers(fitting: Player["fitting"]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const rack of RACK_TYPES) {
    out[rack] = Array(fitting[rack]?.length ?? 0).fill(0);
  }
  return out;
}

function offlineSlotActive(value: Player["slotActive"], fitting: Player["fitting"]): Record<string, boolean[]> {
  const out: Record<string, boolean[]> = {};
  for (const rack of RACK_TYPES) {
    const n = fitting[rack]?.length ?? 0;
    const source = value?.[rack] ?? [];
    out[rack] = Array.from({ length: n }, (_, idx) => source[idx] === true);
  }
  return out;
}

function cloneModuleHp(value: Player["moduleHp"], fitting: Player["fitting"]): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const rack of RACK_TYPES) {
    const n = fitting[rack]?.length ?? 0;
    const source = value?.[rack] ?? [];
    out[rack] = Array.from({ length: n }, (_, idx) => {
      const hp = source[idx];
      return hp == null ? null : finiteNumber(hp, 100, 0);
    });
  }
  return out;
}

export function createServerPlayerState(id: string, name: string, incoming: Player, galaxy: System[]): Player {
  const base = makePlayer();
  const shipId = SHIPS[incoming.shipId] ? incoming.shipId : base.shipId;
  const ship = SHIPS[shipId] ?? SHIPS[base.shipId];
  const maxHp = ship.hull;
  const maxStructure = Math.floor(ship.hull * 0.8);

  const p = clone(base);
  p.netId = id;
  p.shipId = shipId;

  const incomingName = incoming.pilotName?.trim() ? incoming.pilotName : name;
  const pilot = validatePilotName(incomingName);
  p.pilotName = pilot.ok && pilot.name ? pilot.name : name.trim().slice(0, 16) || "Pilot";
  if (!validatePilotName(p.pilotName).ok) p.pilotName = "Pilot";

  p.homeSysIdx = finiteInt(incoming.homeSysIdx, base.homeSysIdx, 0, Math.max(0, galaxy.length - 1));
  p.sysIdx = finiteInt(incoming.sysIdx, p.homeSysIdx, 0, Math.max(0, galaxy.length - 1));
  p.pendingHomeSpawn = incoming.pendingHomeSpawn === true;
  p.x = finiteNumber(incoming.x, base.x, -MAX_ABS_COORD, MAX_ABS_COORD);
  p.y = finiteNumber(incoming.y, base.y, -MAX_ABS_COORD, MAX_ABS_COORD);
  p.px = p.x;
  p.py = p.y;
  p.angle = finiteNumber(incoming.angle, 0, -Math.PI * 2, Math.PI * 2);
  p.prevAngle = p.angle;

  p.vx = 0;
  p.vy = 0;
  p.va = 0;
  p.netInputFrame = null;
  p.inputKeys = null;
  p.inputMouseWorld = null;
  p.waypoint = null;
  p.navCommand = null;

  p.maxHp = maxHp;
  p.hp = finiteNumber(incoming.hp, maxHp, 0, maxHp);
  p.maxStructure = maxStructure;
  p.structure = finiteNumber(incoming.structure, maxStructure, 0, maxStructure);
  p.maxShield = finiteNumber(incoming.maxShield ?? base.maxShield ?? 0, base.maxShield ?? 0, 0, 10_000);
  p.shield = finiteNumber(incoming.shield, base.shield, 0, p.maxShield ?? 0);
  p.energy = finiteNumber(incoming.energy, base.energy, 0, 10_000);

  p.credits = finiteNumber(incoming.credits, base.credits, 0);
  p.ore = cloneNumberRecord(incoming.ore, base.ore);
  p.refined = cloneNumberRecord(incoming.refined, base.refined);
  p.loot = cloneNumberRecord(incoming.loot, base.loot);
  p.components = cloneNumberRecord(incoming.components, base.components);
  p.ammo = {
    hybrid: finiteNumber(incoming.ammo?.hybrid ?? base.ammo.hybrid, base.ammo.hybrid, 0),
    missile: finiteNumber(incoming.ammo?.missile ?? base.ammo.missile, base.ammo.missile, 0),
  };

  p.moduleCargo = Array.isArray(incoming.moduleCargo) ? clone(incoming.moduleCargo) : clone(base.moduleCargo);
  p.fitting = cloneFitting(incoming.fitting, base.fitting, ship);
  p.moduleHp = cloneModuleHp(incoming.moduleHp, p.fitting);
  p.slotActive = offlineSlotActive(incoming.slotActive, p.fitting);
  p.slotPowerCd = zeroSlotTimers(p.fitting);
  const hardpointRack = getHardpointRack(ship);
  const hardpointCount = p.fitting[hardpointRack]?.length ?? p.turretPower.length;
  p.turretTargets = Array(hardpointCount).fill(null);
  p.highTargets = Array(p.fitting.high?.length ?? 0).fill(null);
  p.turretCds = Array(hardpointCount).fill(0);
  p.turretPower = Array(hardpointCount).fill(false);
  p.turretPowerCd = Array(hardpointCount).fill(0);
  p.fireControlSlot = 0;
  p.targetLock = null;
  p.lockQueue = [];
  p._assignTargetId = null;

  p.blueprints = cloneBooleanRecord(incoming.blueprints, base.blueprints);
  p.skills = cloneNumberRecord(incoming.skills, base.skills);
  p.skillXp = cloneNumberRecord(incoming.skillXp, base.skillXp);
  p.xp = finiteNumber(incoming.xp, base.xp, 0);
  p.level = finiteInt(incoming.level, base.level, 1);
  p.kills = finiteInt(incoming.kills, base.kills, 0);
  p.contracts = Array.isArray(incoming.contracts) ? clone(incoming.contracts) : clone(base.contracts);
  p.stationOffers = [];
  p.stationOfferStationId = null;
  p.craftQueue = Array.isArray(incoming.craftQueue) ? clone(incoming.craftQueue) : [];
  p.hubQueue = Array.isArray(incoming.hubQueue) ? clone(incoming.hubQueue) : [];
  p.hubOutput = incoming.hubOutput ? clone(incoming.hubOutput) : clone(base.hubOutput);
  p.hubDeposit = incoming.hubDeposit ? clone(incoming.hubDeposit) : clone(base.hubDeposit);

  p.tutorial = incoming.tutorial ? clone(incoming.tutorial) : clone(base.tutorial);
  p.detectedSignatures = Array.isArray(incoming.detectedSignatures) ? clone(incoming.detectedSignatures) : [];
  p.scannedSiteIds = cloneStringArray(incoming.scannedSiteIds);
  p.completedSiteIds = cloneStringArray(incoming.completedSiteIds);
  p.discoveredConcentricSectors = Array.isArray(incoming.discoveredConcentricSectors)
    ? incoming.discoveredConcentricSectors.map((idx) => finiteInt(idx, 0, 0)).filter((idx) => idx > 0)
    : [];
  p.discoveredLocalRegionIds = cloneStringArray(incoming.discoveredLocalRegionIds);
  p.scannerAngle = finiteNumber(incoming.scannerAngle, base.scannerAngle, -Math.PI * 2, Math.PI * 2);
  p.scannerConeDeg = [180, 90, 45, 15].includes(incoming.scannerConeDeg) ? incoming.scannerConeDeg : base.scannerConeDeg;
  p.mapScannerActive = incoming.mapScannerActive === true;
  p.mapScannerStrength = finiteNumber(incoming.mapScannerStrength, base.mapScannerStrength, 0, 1);
  p.activeScan = null;

  p.shootCd = 0;
  p.mineCd = 0;
  p.invincible = 1.5;
  p.thrustFx = false;
  p.recoilFrames = 0;
  p.shieldCd = 0;
  p.shieldHitGlow = 0;
  p.shieldHitAngle = 0;
  p.hullHitGlow = 0;
  p.hullHitAngle = 0;
  p.structureHitGlow = 0;
  p.structureHitAngle = 0;
  p.miningLaser = null;
  p.salvager = null;
  p.tractor = null;
  p.gateCooldowns = {};
  p.gatesCleared = [];
  p.warpCooldown = 0;
  p.warpTargetIdx = -1;

  resolvePlayerSpawn(p, galaxy);
  return p;
}

export function createDurableCharacterSync(source: Player): Player {
  const p = clone(source);
  delete p.netId;
  p.netInputFrame = null;
  p.inputKeys = null;
  p.inputMouseWorld = null;
  p.vx = 0;
  p.vy = 0;
  p.va = 0;
  p.px = p.x;
  p.py = p.y;
  p.prevAngle = p.angle;
  p.waypoint = null;
  p.navCommand = null;
  p.targetLock = null;
  p.lockQueue = [];
  p._assignTargetId = null;
  p.turretTargets = Array(p.turretTargets?.length ?? 0).fill(null);
  p.highTargets = Array(p.highTargets?.length ?? 0).fill(null);
  p.turretCds = Array(p.turretCds?.length ?? 0).fill(0);
  p.turretPower = Array(p.turretPower?.length ?? 0).fill(false);
  p.turretPowerCd = Array(p.turretPowerCd?.length ?? 0).fill(0);
  p.slotPowerCd = zeroSlotTimers(p.fitting);
  p.shootCd = 0;
  p.mineCd = 0;
  p.invincible = 0;
  p.thrustFx = false;
  p.recoilFrames = 0;
  p.shieldCd = 0;
  p.shieldHitGlow = 0;
  p.shieldHitAngle = 0;
  p.hullHitGlow = 0;
  p.hullHitAngle = 0;
  p.structureHitGlow = 0;
  p.structureHitAngle = 0;
  p.miningLaser = null;
  p.salvager = null;
  p.tractor = null;
  p.activeScan = null;
  p.warpCooldown = 0;
  p.warpTargetIdx = -1;
  return p;
}
