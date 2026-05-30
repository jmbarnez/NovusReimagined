import { _G, Client, type Player, type HubJob, type HubOutput, type HubDeposit, type HubDepositItem } from "../../state.js";
import { LOCAL_PLAYER_ID, registerPlayer, getLocalPlayer } from "../../player-registry.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import type { LockSlot } from "../../types/world.js";
import type { CraftJob } from "../../data/industryRecipes.js";
import type { MissionContract } from "../../data/missions.js";

export const PlayerAccess = {
  /** Update player position & velocity in one call. */
  updatePhysics(data: {
    x?: number; y?: number;
    px?: number; py?: number;
    vx?: number; vy?: number; va?: number;
    angle?: number; prevAngle?: number;
    thrustFx?: boolean;
  }, p: Player = _G.P) {
    if (data.x !== undefined) p.x = data.x;
    if (data.y !== undefined) p.y = data.y;
    if (data.px !== undefined) p.px = data.px;
    if (data.py !== undefined) p.py = data.py;
    if (data.vx !== undefined) p.vx = data.vx;
    if (data.vy !== undefined) p.vy = data.vy;
    if (data.va !== undefined) p.va = data.va;
    if (data.angle !== undefined) p.angle = data.angle;
    if (data.prevAngle !== undefined) p.prevAngle = data.prevAngle;
    if (data.thrustFx !== undefined) p.thrustFx = data.thrustFx;
  },

  /** Modify player credits (positive = gain, negative = spend). */
  modifyCredits(amount: number, p: Player = _G.P) {
    p.credits += amount;
  },

  /** Set a fitting slot to a module UID or null. */
  setFittingSlot(rack: string, idx: number, uid: string | null, p: Player = _G.P) {
    if (!p.fitting[rack]) p.fitting[rack] = [];
    p.fitting[rack][idx] = uid;
  },

  /** Bulk-replace fitting layout. */
  setFittingAll(fitting: Player["fitting"], p: Player = _G.P) {
    p.fitting = fitting;
  },

  /** Set module HP for a slot. */
  setModuleHp(rack: string, idx: number, hp: number | null, p: Player = _G.P) {
    if (!p.moduleHp[rack]) p.moduleHp[rack] = [];
    p.moduleHp[rack][idx] = hp;
  },

  /** Set slot active state. */
  setSlotActive(rack: string, idx: number, active: boolean, p: Player = _G.P) {
    if (!p.slotActive[rack]) p.slotActive[rack] = [];
    p.slotActive[rack][idx] = active;
  },

  /** Update slot power cooldown (med/low racks). */
  setSlotPowerCd(rack: string, idx: number, cd: number, p: Player = _G.P) {
    if (!p.slotPowerCd) p.slotPowerCd = {};
    if (!p.slotPowerCd[rack]) p.slotPowerCd[rack] = [];
    p.slotPowerCd[rack][idx] = cd;
  },

  setSlotPowerCdAll(record: Record<string, number[]>, p: Player = _G.P) {
    p.slotPowerCd = record;
  },

  /** Update turret power state. */
  setTurretPower(idx: number, powered: boolean, p: Player = _G.P) {
    if (!p.turretPower) p.turretPower = [];
    p.turretPower[idx] = powered;
  },

  /** Update turret power cooldown. */
  setTurretPowerCd(idx: number, cd: number, p: Player = _G.P) {
    if (!p.turretPowerCd) p.turretPowerCd = [];
    p.turretPowerCd[idx] = cd;
  },

  /** Update turret cooldown. */
  setTurretCd(idx: number, cd: number, p: Player = _G.P) {
    if (!p.turretCds) p.turretCds = [];
    p.turretCds[idx] = cd;
  },

  /** Update shield value. */
  setShield(value: number, p: Player = _G.P) {
    p.shield = value;
  },

  /** Update HP value. */
  setHp(value: number, p: Player = _G.P) {
    p.hp = value;
  },

  /** Update structure value. */
  setStructure(value: number, p: Player = _G.P) {
    p.structure = value;
  },

  /** Update energy value. */
  setEnergy(value: number, p: Player = _G.P) {
    p.energy = value;
  },

  /** Update slot heat. */
  setSlotHeat(rack: string, idx: number, heat: number, p: Player = _G.P) {
    if (!p.slotHeat) p.slotHeat = {};
    if (!p.slotHeat[rack]) p.slotHeat[rack] = [];
    p.slotHeat[rack][idx] = heat;
  },

  /** Update invincibility timer. */
  setInvincible(value: number, p: Player = _G.P) {
    p.invincible = value;
  },

  /** Update collision cooldown. */
  setColCooldown(value: number, p: Player = _G.P) {
    p._colCooldown = value;
  },

  /** Update shield hit glow. */
  setShieldHitGlow(value: number, p: Player = _G.P) {
    p.shieldHitGlow = value;
  },

  /** Update shield hit angle. */
  setShieldHitAngle(value: number, p: Player = _G.P) {
    p.shieldHitAngle = value;
  },

  /** Update hull hit glow. */
  setHullHitGlow(value: number, p: Player = _G.P) {
    p.hullHitGlow = value;
  },

  /** Update hull hit angle. */
  setHullHitAngle(value: number, p: Player = _G.P) {
    p.hullHitAngle = value;
  },

  /** Update structure hit glow. */
  setStructureHitGlow(value: number, p: Player = _G.P) {
    p.structureHitGlow = value;
  },

  /** Update structure hit angle. */
  setStructureHitAngle(value: number, p: Player = _G.P) {
    p.structureHitAngle = value;
  },

  /** Update combat heat (Client state). */
  setCombatHeat(value: number) {
    Client.combatHeat = value;
  },

  /** Update target lock. */
  setTargetLock(target: Player["targetLock"], p: Player = _G.P) {
    p.targetLock = target;
  },

  /** Update lock queue. */
  setLockQueue(queue: Player["lockQueue"], p: Player = _G.P) {
    p.lockQueue = queue;
  },

  /** Update fire control slot. */
  setFireControlSlot(slot: number, p: Player = _G.P) {
    p.fireControlSlot = slot;
  },

  /** Update turret targets. */
  setTurretTarget(idx: number, targetId: string | null, p: Player = _G.P) {
    if (!p.turretTargets) p.turretTargets = [];
    p.turretTargets[idx] = targetId;
  },

  /** Update shoot cooldown. */
  setShootCd(value: number, p: Player = _G.P) {
    p.shootCd = value;
  },

  /** Update mine cooldown. */
  setMineCd(value: number, p: Player = _G.P) {
    p.mineCd = value;
  },

  /** Update recoil frames. */
  setRecoilFrames(value: number, p: Player = _G.P) {
    p.recoilFrames = value;
  },

  /** Update XP. */
  setXp(value: number, p: Player = _G.P) {
    p.xp = value;
  },

  /** Update level. */
  setLevel(value: number, p: Player = _G.P) {
    p.level = value;
  },

  /** Update kills. */
  setKills(value: number, p: Player = _G.P) {
    p.kills = value;
  },

  /** Update skill XP. */
  setSkillXp(skillId: string, value: number, p: Player = _G.P) {
    p.skillXp[skillId] = value;
  },

  /** Update skill level. */
  setSkill(skillId: string, level: number, p: Player = _G.P) {
    p.skills[skillId] = level;
  },

  /** Update ammo. */
  setAmmo(type: "hybrid" | "missile", value: number, p: Player = _G.P) {
    p.ammo[type] = value;
  },

  /** Update ore. */
  setOre(type: string, value: number, p: Player = _G.P) {
    p.ore[type] = value;
  },

  /** Bulk-replace ore map. */
  setOreAll(ore: Record<string, number>, p: Player = _G.P) {
    p.ore = ore;
  },

  /** Update refined. */
  setRefined(type: string, value: number, p: Player = _G.P) {
    p.refined[type] = value;
  },

  /** Bulk-replace refined map. */
  setRefinedAll(refined: Record<string, number>, p: Player = _G.P) {
    p.refined = refined;
  },

  /** Update loot. */
  setLoot(type: string, value: number, p: Player = _G.P) {
    p.loot[type] = value;
  },

  /** Bulk-replace loot map. */
  setLootAll(loot: Record<string, number>, p: Player = _G.P) {
    p.loot = loot;
  },

  /** Update components. */
  setComponents(type: string, value: number, p: Player = _G.P) {
    p.components[type] = value;
  },

  /** Bulk-replace components map. */
  setComponentsAll(components: Record<string, number>, p: Player = _G.P) {
    p.components = components;
  },

  /** Bulk-replace ammo counts. */
  setAmmoAll(ammo: { hybrid: number; missile: number }, p: Player = _G.P) {
    p.ammo = ammo;
  },

  /** Update contracts. */
  setContracts(contracts: Player["contracts"], p: Player = _G.P) {
    p.contracts = contracts;
  },

  /** Update station contract offers for current docked station. */
  setStationOffers(offers: Player["stationOffers"], stationId: string | null, p: Player = _G.P) {
    p.stationOffers = offers;
    p.stationOfferStationId = stationId;
  },

  /** Update craft queue. */
  setCraftQueue(queue: Player["craftQueue"], p: Player = _G.P) {
    p.craftQueue = queue;
  },

  /** Update blueprints. */
  setBlueprint(id: string, owned: boolean, p: Player = _G.P) {
    p.blueprints[id] = owned;
  },

  /** Bulk-replace blueprints map. */
  setBlueprintsAll(blueprints: Record<string, boolean>, p: Player = _G.P) {
    p.blueprints = blueprints;
  },

  /** Bulk-replace skills map. */
  setSkillsAll(skills: Record<string, number>, p: Player = _G.P) {
    p.skills = skills;
  },

  /** Bulk-replace skill XP map. */
  setSkillXpAll(skillXp: Record<string, number>, p: Player = _G.P) {
    p.skillXp = skillXp;
  },

  // ─── Bulk setters & additional fields ────────────────────────────────────

  /** Set current system index. */
  setSysIdx(value: number, p: Player = _G.P) {
    p.sysIdx = value;
  },

  /** Set max HP. */
  setMaxHp(value: number, p: Player = _G.P) {
    p.maxHp = value;
  },

  /** Set max structure. */
  setMaxStructure(value: number, p: Player = _G.P) {
    p.maxStructure = value;
  },

  /** Set max shield. */
  setMaxShield(value: number, p: Player = _G.P) {
    p.maxShield = value;
  },

  /** Set combat bar state. */
  setCombatBar(bar: Player["combatBar"], p: Player = _G.P) {
    p.combatBar = bar;
  },

  /** Set internal assign-target ID. */
  setAssignTargetId(id: string | null, p: Player = _G.P) {
    p._assignTargetId = id;
  },

  /** Set high-slot target. */
  setHighTarget(idx: number, targetId: string | null, p: Player = _G.P) {
    if (!p.highTargets) p.highTargets = [];
    p.highTargets[idx] = targetId;
  },

  /** Set pending home spawn flag. */
  setPendingHomeSpawn(value: boolean, p: Player = _G.P) {
    p.pendingHomeSpawn = value;
  },

  /** Add a module instance to cargo. */
  addModuleCargo(inst: ModuleInstance, p: Player = _G.P) {
    p.moduleCargo.push(inst);
  },

  /** Bulk-replace module cargo. */
  setModuleCargo(cargo: Player["moduleCargo"], p: Player = _G.P) {
    p.moduleCargo = cargo;
  },

  /** Bulk-replace all slot active states. */
  setSlotActiveAll(record: Record<string, boolean[]>, p: Player = _G.P) {
    p.slotActive = record;
  },

  /** Bulk-replace all module HP. */
  setModuleHpAll(record: Record<string, (number | null)[]>, p: Player = _G.P) {
    p.moduleHp = record;
  },

  /** Bulk-replace turret targets array. */
  setTurretTargetsAll(targets: (string | null)[], p: Player = _G.P) {
    p.turretTargets = targets;
  },

  /** Bulk-replace turret cooldowns array. */
  setTurretCdsAll(cds: number[], p: Player = _G.P) {
    p.turretCds = cds;
  },

  /** Bulk-replace turret power states. */
  setTurretPowerAll(powers: boolean[], p: Player = _G.P) {
    p.turretPower = powers;
  },

  /** Bulk-replace turret power cooldowns. */
  setTurretPowerCdAll(cds: number[], p: Player = _G.P) {
    p.turretPowerCd = cds;
  },

  /** Bulk-replace all slot heat. */
  setSlotHeatAll(heat: Record<string, number[]>, p: Player = _G.P) {
    p.slotHeat = heat;
  },

  /** Set shield cooldown. */
  setShieldCd(value: number, p: Player = _G.P) {
    p.shieldCd = value;
  },

  /** Set home system index. */
  setHomeSysIdx(value: number, p: Player = _G.P) {
    p.homeSysIdx = value;
  },

  /** Set a module instance's durability by UID. */
  setModuleDurability(uid: string, value: number, p: Player = _G.P) {
    const inst = p.moduleCargo.find(i => i.uid === uid);
    if (inst) inst.durability = Math.max(0, value);
  },

  /** Remove a module from cargo by index. */
  removeModuleCargo(index: number, p: Player = _G.P) {
    p.moduleCargo.splice(index, 1);
  },

  /** Add a craft job to the queue. */
  addCraftJob(job: CraftJob, p: Player = _G.P) {
    p.craftQueue.push(job);
  },

  /** Remove a craft job by index. */
  removeCraftJob(index: number, p: Player = _G.P) {
    p.craftQueue.splice(index, 1);
  },

  /** Add an accepted contract. */
  addContract(contract: MissionContract, p: Player = _G.P) {
    p.contracts.push(contract);
  },

  /** Remove a contract by index. */
  removeContract(index: number, p: Player = _G.P) {
    p.contracts.splice(index, 1);
  },

  /** Splice lockQueue at index. Returns removed items. */
  spliceLockQueue(index: number, deleteCount: number, p: Player = _G.P) {
    return p.lockQueue.splice(index, deleteCount);
  },

  /** Unshift an item onto lockQueue. */
  unshiftLockQueue(item: LockSlot, p: Player = _G.P) {
    p.lockQueue.unshift(item);
  },

  /** Pop the last item from lockQueue. */
  popLockQueue(p: Player = _G.P) {
    return p.lockQueue.pop();
  },

  /** Set tractor carry mass. */
  setTractorCarryKg(value: number, p: Player = _G.P) {
    p.tractorCarryKg = value;
  },

  /** Set tractor tightness value. */
  setTractorTightness(value: number, p: Player = _G.P) {
    p.tractorTightness = value;
  },

  /** Add a job to the processing hub queue. */
  addHubJob(job: HubJob, p: Player = _G.P) {
    if (!p.hubQueue) p.hubQueue = [];
    p.hubQueue.push(job);
  },

  /** Bulk-replace processing hub queue. */
  setHubQueue(queue: HubJob[], p: Player = _G.P) {
    p.hubQueue = queue;
  },

  /** Splice processing hub queue. */
  spliceHubQueue(index: number, deleteCount: number, p: Player = _G.P) {
    if (!p.hubQueue) p.hubQueue = [];
    return p.hubQueue.splice(index, deleteCount);
  },

  /** Set the processing hub output storage. */
  setHubOutput(output: HubOutput, p: Player = _G.P) {
    p.hubOutput = output;
  },

  /** Add a module instance to processing hub output modules. */
  addHubOutputModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.modules) p.hubOutput.modules = [];
    p.hubOutput.modules.push(inst);
  },

  /** Update hub output loot quantity. */
  setHubOutputLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.loot) p.hubOutput.loot = {};
    p.hubOutput.loot[type] = value;
  },

  /** Update hub output ore quantity. */
  setHubOutputOre(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.ore) p.hubOutput.ore = {};
    p.hubOutput.ore[type] = value;
  },

  /** Update hub output refined quantity. */
  setHubOutputRefined(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.refined) p.hubOutput.refined = {};
    p.hubOutput.refined[type] = value;
  },

  /** Set the processing hub deposit stockpile. */
  setHubDeposit(deposit: HubDeposit, p: Player = _G.P) {
    p.hubDeposit = deposit;
  },

  /** Add a raw unprocessed item to the hub drop bay. */
  addHubDepositItem(item: HubDepositItem, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.raw) p.hubDeposit.raw = [];
    p.hubDeposit.raw.push(item);
  },

  /** Remove a raw deposit item by id. Returns true if removed. */
  removeHubDepositItem(id: string, p: Player = _G.P): boolean {
    if (!p.hubDeposit?.raw) return false;
    const idx = p.hubDeposit.raw.findIndex(i => i.id === id);
    if (idx === -1) return false;
    p.hubDeposit.raw.splice(idx, 1);
    return true;
  },

  /** Update hub deposit ore quantity. */
  setHubDepositOre(type: string, value: number, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.ore) p.hubDeposit.ore = {};
    p.hubDeposit.ore[type] = value;
  },

  /** Update hub deposit loot quantity. */
  setHubDepositLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.loot) p.hubDeposit.loot = {};
    p.hubDeposit.loot[type] = value;
  },

  /** Add a module instance to hub deposit stockpile. */
  addHubDepositModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.modules) p.hubDeposit.modules = [];
    p.hubDeposit.modules.push(inst);
  },

  /** Update a specific slot's properties in the lock queue in-place. */
  updateLockQueueSlot(id: string, data: Partial<LockSlot>, p: Player = _G.P) {
    const slot = p.lockQueue?.find(s => s.id === id);
    if (slot) {
      Object.assign(slot, data);
    }
  },

  setTutorialStep(step: number, p: Player = _G.P) {
    p.tutorial.step = step;
  },

  setTutorialStepEnteredAt(at: number, p: Player = _G.P) {
    p.tutorial.stepEnteredAt = at;
  },

  setTutorialActive(active: boolean, p: Player = _G.P) {
    p.tutorial.active = active;
  },

  setTutorialComplete(p: Player = _G.P) {
    p.tutorial.active = false;
    p.tutorial.completed = true;
    p.tutorial.step = 11;
  },

  setTutorialSkipped(p: Player = _G.P) {
    p.tutorial.skipped = true;
  },

  setTutorialState(state: Player["tutorial"], p: Player = _G.P) {
    p.tutorial = state;
  },

  setDetectedSignatures(signatures: Player["detectedSignatures"], p: Player = _G.P) {
    p.detectedSignatures = signatures;
  },

  addDetectedSignature(signature: Player["detectedSignatures"][number], p: Player = _G.P) {
    p.detectedSignatures.push(signature);
  },

  setScannedSiteIds(ids: Player["scannedSiteIds"], p: Player = _G.P) {
    p.scannedSiteIds = ids;
  },

  addScannedSiteId(id: string, p: Player = _G.P) {
    if (!p.scannedSiteIds.includes(id)) p.scannedSiteIds.push(id);
  },

  setCompletedSiteIds(ids: Player["completedSiteIds"], p: Player = _G.P) {
    p.completedSiteIds = ids;
  },

  addCompletedSiteId(id: string, p: Player = _G.P) {
    if (!p.completedSiteIds.includes(id)) p.completedSiteIds.push(id);
  },

  setActiveScan(activeScan: Player["activeScan"], p: Player = _G.P) {
    p.activeScan = activeScan;
  },

  setScannerAngle(angle: number, p: Player = _G.P) {
    p.scannerAngle = angle;
  },

  setWarpCooldown(value: number, p: Player = _G.P) {
    p.warpCooldown = value;
  },

  setWarpTargetIdx(value: number, p: Player = _G.P) {
    p.warpTargetIdx = value;
  },

  setScannerConeDeg(coneDeg: Player["scannerConeDeg"], p: Player = _G.P) {
    p.scannerConeDeg = coneDeg;
  },

  setMapScannerActive(active: boolean, p: Player = _G.P) {
    p.mapScannerActive = active;
  },

  setMapScannerStrength(strength: number, p: Player = _G.P) {
    p.mapScannerStrength = Math.max(0, Math.min(1, strength));
  },

  addDiscoveredConcentricSector(sectorIdx: number, p: Player = _G.P) {
    if (!p.discoveredConcentricSectors.includes(sectorIdx)) {
      p.discoveredConcentricSectors.push(sectorIdx);
    }
  },

  addDiscoveredLocalRegion(regionId: string, p: Player = _G.P) {
    if (!p.discoveredLocalRegionIds.includes(regionId)) {
      p.discoveredLocalRegionIds.push(regionId);
    }
  },

  updateDetectedSignature(siteId: string, patch: Partial<Player["detectedSignatures"][number]>, p: Player = _G.P) {
    const entry = p.detectedSignatures.find((contact) => contact.siteId === siteId && contact.systemId === p.sysIdx);
    if (entry) Object.assign(entry, patch);
  },

  removeDetectedSignature(siteId: string, p: Player = _G.P) {
    p.detectedSignatures = p.detectedSignatures.filter((contact) => !(contact.siteId === siteId && contact.systemId === p.sysIdx));
  },

  setNetId(netId: string, p: Player = _G.P) {
    p.netId = netId;
  },

  setPilotName(name: string, p: Player = _G.P) {
    p.pilotName = name;
  },

  addServerPlayer(p: Player) {
    registerPlayer(p, p.netId ?? p.shipId);
    if (!_G.P) _G.P = p;
  },

  installServerPrimaryPlayer(p: Player) {
    _G.players.clear();
    registerPlayer(p, p.netId ?? LOCAL_PLAYER_ID);
    _G.P = p;
  },

  removeServerPlayer(netId: string) {
    if (!_G.players) return;
    const local = getLocalPlayer();
    if (local && (netId === LOCAL_PLAYER_ID || netId === local.netId)) return;
    _G.players.delete(netId);
  },

  clearServerPlayers() {
    if (!_G.players) return;
    const local = getLocalPlayer();
    _G.players.clear();
    if (local) {
      registerPlayer(local, LOCAL_PLAYER_ID);
      _G.P = local;
    }
  },
};
