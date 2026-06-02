import { Client, type Player } from "../../state.js";
import { PlayerAccess, MiningAccess, SalvagerAccess, TractorAccess, getState } from "../../state-access.js";
import { invalidate } from "../../player/player-stats.js";
import type { WorldSnapshot } from "../../sim/snapshot.js";
import { populateSystem } from "../../world-gen.js";
import { netLog } from "../../ui/net-console.js";
import { emit } from "../../events.js";
import { booleanArrayRecordsEqual, cloneArrayRecord } from "./converters.js";

export function shouldApplyLocalPlayerSnapshot(p: Player | null, snap: WorldSnapshot): boolean {
  return !(
    p &&
    snap.player.netId &&
    p.netId &&
    snap.player.netId !== p.netId
  );
}

export function applyLocalPlayerSnapshot(p: Player, snap: WorldSnapshot, isFullSnapshot: boolean): void {
  const prevSysIdx = p.sysIdx;
  const dist = Math.hypot(p.x - snap.player.x, p.y - snap.player.y);
  const shouldSnap = isFullSnapshot || dist > 1000;

  if (snap.player.sysIdx !== prevSysIdx) {
    netLog(`sysIdx change ${prevSysIdx} → ${snap.player.sysIdx}`);
    const newSys = getState().GALAXY[snap.player.sysIdx];
    if (newSys && !newSys._ready) {
      populateSystem(newSys);
      netLog(`populateSystem sys=${snap.player.sysIdx} (${newSys.name}) from snapshot`);
    }
  }

  p.x = snap.player.x;
  p.y = snap.player.y;
  p.vx = snap.player.vx;
  p.vy = snap.player.vy;
  p.va = snap.player.va;
  p.angle = snap.player.angle;
  p.hp = snap.player.hp;
  p.maxHp = snap.player.maxHp;
  p.shield = snap.player.shield;
  p.maxShield = snap.player.maxShield;
  p.energy = snap.player.energy;
  p.credits = snap.player.credits;
  if (typeof snap.player.homeSysIdx === "number") PlayerAccess.setHomeSysIdx(snap.player.homeSysIdx, p);
  if (snap.player.ore) PlayerAccess.setOreAll({ ...snap.player.ore }, p);
  if (snap.player.mixedOreCargo) PlayerAccess.setMixedOreCargo(snap.player.mixedOreCargo, p);
  if (snap.player.refined) PlayerAccess.setRefinedAll({ ...snap.player.refined }, p);
  if (snap.player.loot) PlayerAccess.setLootAll({ ...snap.player.loot }, p);
  if (snap.player.components) PlayerAccess.setComponentsAll({ ...snap.player.components }, p);
  if (snap.player.ammo) PlayerAccess.setAmmoAll({ ...snap.player.ammo }, p);
  if (snap.player.blueprints) PlayerAccess.setBlueprintsAll({ ...snap.player.blueprints }, p);
  if (snap.player.skills) PlayerAccess.setSkillsAll({ ...snap.player.skills }, p);
  if (snap.player.skillXp) PlayerAccess.setSkillXpAll({ ...snap.player.skillXp }, p);
  if (typeof snap.player.xp === "number") PlayerAccess.setXp(snap.player.xp, p);
  if (typeof snap.player.level === "number") PlayerAccess.setLevel(snap.player.level, p);
  if (snap.player.craftQueue) PlayerAccess.setCraftQueue(snap.player.craftQueue.map((job) => ({ ...job })), p);
  if (snap.player.hubQueue) PlayerAccess.setHubQueue(snap.player.hubQueue.map((job) => ({ ...job })), p);
  if (snap.player.hubOutput) {
    PlayerAccess.setHubOutput(JSON.parse(JSON.stringify(snap.player.hubOutput)), p);
  }
  if (snap.player.hubDeposit) {
    PlayerAccess.setHubDeposit(JSON.parse(JSON.stringify(snap.player.hubDeposit)), p);
  }
  if (snap.player.moduleCargo) {
    PlayerAccess.setModuleCargo(
      snap.player.moduleCargo.map((inst) => ({
        ...inst,
        affixes: inst.affixes.map((affix) => ({ ...affix })),
      })),
      p,
    );
  }
  if (snap.player.contracts) {
    PlayerAccess.setContracts(
      snap.player.contracts.map((contract) => ({ ...contract, objective: { ...contract.objective } })),
      p,
    );
  }
  if (snap.player.stationOffers) {
    PlayerAccess.setStationOffers(
      snap.player.stationOffers.map((contract) => ({ ...contract })),
      snap.player.stationOfferStationId ?? null,
      p,
    );
  }
  p.sysIdx = snap.player.sysIdx;
  p.waypoint = snap.player.waypoint;
  p.navCommand = snap.player.navCommand;
  p.gateCooldowns = snap.player.gateCooldowns ? { ...snap.player.gateCooldowns } : {};
  p.gatesCleared = snap.player.gatesCleared ? [...snap.player.gatesCleared] : [];
  PlayerAccess.setTargetLock(snap.player.targetLock ? { ...snap.player.targetLock } : null, p);
  const incomingLocks = snap.player.lockQueue ? snap.player.lockQueue.map((s) => ({ ...s })) : [];
  PlayerAccess.setLockQueue(incomingLocks, p);
  PlayerAccess.setAssignTargetId(snap.player._assignTargetId ?? null, p);
  if (snap.player.turretTargets) {
    PlayerAccess.setTurretTargetsAll([...snap.player.turretTargets], p);
  }
  if (snap.player.highTargets) {
    for (let i = 0; i < snap.player.highTargets.length; i++) {
      PlayerAccess.setHighTarget(i, snap.player.highTargets[i], p);
    }
  }
  let slotActiveChanged = false;
  if (snap.player.slotActive) {
    if (!booleanArrayRecordsEqual(p.slotActive, snap.player.slotActive)) {
      PlayerAccess.setSlotActiveAll(cloneArrayRecord(snap.player.slotActive), p);
      slotActiveChanged = true;
    }
  }
  if (snap.player.turretPower) {
    PlayerAccess.setTurretPowerAll([...snap.player.turretPower], p);
  }
  if (snap.player.turretCds) {
    PlayerAccess.setTurretCdsAll([...snap.player.turretCds], p);
  }
  if (snap.player.turretPowerCd) {
    PlayerAccess.setTurretPowerCdAll([...snap.player.turretPowerCd], p);
  }
  if (snap.player.slotPowerCd) {
    PlayerAccess.setSlotPowerCdAll(cloneArrayRecord(snap.player.slotPowerCd), p);
  }
  if (snap.player.moduleHp) {
    PlayerAccess.setModuleHpAll(cloneArrayRecord(snap.player.moduleHp), p);
  }
  if (snap.player.fitting) {
    PlayerAccess.setFittingAll(cloneArrayRecord(snap.player.fitting), p);
  }

  emit("inventory:changed");
  if (slotActiveChanged) {
    invalidate(p);
  }
  if (Client.multiplayerRole !== "client" || shouldSnap) {
    Client.waypoint = snap.player.waypoint;
    Client.navCommand = snap.player.navCommand;
  }

  if (snap.player.miningLaser) {
    MiningAccess.update(snap.player.miningLaser, p);
  } else {
    MiningAccess.update({ active: false }, p);
  }
  if (snap.player.salvager) {
    SalvagerAccess.update(snap.player.salvager, p);
  } else {
    SalvagerAccess.update({ active: false }, p);
  }
  if (snap.player.tractor) {
    TractorAccess.update(snap.player.tractor, p);
  } else {
    TractorAccess.update({ active: false }, p);
  }

  if (shouldSnap) {
    p.px = snap.player.x;
    p.py = snap.player.y;
    Client.camx = snap.player.x;
    Client.camy = snap.player.y;
    netLog(`camera snap → (${snap.player.x.toFixed(0)},${snap.player.y.toFixed(0)})`);
  }
}
