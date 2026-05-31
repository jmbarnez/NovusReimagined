import { Client } from "../state.js";
import { PlayerAccess, MiningAccess, SalvagerAccess, TractorAccess, getState } from "../state-access.js";
import { invalidate } from "../player/player-stats.js";
import type { WorldSnapshot, EntitySnapshot } from "../sim/snapshot.js";
import { populateSystem } from "../world-gen.js";
import { netLog } from "../ui/net-console.js";
import { addBullet, addEnemyBullet, addWreckPiece, addSalvagePickup } from "../utils/entities.js";
import type { DamageProfile, WeaponDelivery } from "../data/modules.js";
import type { SalvagePickup } from "../types/world.js";
import { showPickupToast } from "../feedback.js";
import { emit } from "../events.js";
import { makeRemotePlayerStub, type RemotePlayerBrief } from "./remote-peers.js";

function toWeaponDelivery(kind: EntitySnapshot["kind"]): WeaponDelivery | null {
  return kind === "projectile" || kind === "beam" || kind === "missile" ? kind : null;
}

function toDamageProfile(profile: EntitySnapshot["dmgProfile"]): DamageProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  return profile as DamageProfile;
}

function toSalvageKind(kind: EntitySnapshot["kind"]): SalvagePickup["kind"] {
  if (kind === "loot" || kind === "module" || kind === "ore" || kind === "credits") return kind;
  return "loot";
}

function cloneArrayRecord<T>(record: Record<string, T[]>): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const key of Object.keys(record)) {
    out[key] = [...record[key]];
  }
  return out;
}

function booleanArrayRecordsEqual(a: Record<string, boolean[]> | undefined, b: Record<string, boolean[]>): boolean {
  if (!a) return Object.keys(b).length === 0;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of bKeys) {
    const left = a[key] ?? [];
    const right = b[key] ?? [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < right.length; i++) {
      if (left[i] !== right[i]) return false;
    }
  }
  return true;
}

function applyLocalPlayerFromSnapshot(snap: WorldSnapshot): boolean {
  const p = getState().player;
  if (!p) return false;
  if (snap.player.netId && p.netId && snap.player.netId !== p.netId) return false;
  return true;
}

export function applySnapshotToG(snap: WorldSnapshot, isFullSnapshot = false) {
  const p = getState().player;
  const applyLocalPlayer = !(
    p &&
    snap.player.netId &&
    p.netId &&
    snap.player.netId !== p.netId
  );
  if (p && !applyLocalPlayer) {
    netLog(`[WARN] snapshot player netId mismatch got=${snap.player.netId} local=${p.netId} — peers only`);
  }

  if (p && applyLocalPlayer) {
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

    // Utility beam visuals are server-authoritative and must always mirror snapshot state.
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

  const sys = getState().GALAXY[snap.player.sysIdx] || getState().GALAXY[0];
  if (!sys) return;

  if (!sys._ready) {
    populateSystem(sys);
  }

  getState().bullets.length = 0;
  getState().enemyBullets.length = 0;

  const snapWrecks = new Map<string, EntitySnapshot>();
  const snapSalvages = new Map<string, EntitySnapshot>();
  const snapPlayers = new Map<string, EntitySnapshot>();
  const snapEnemies = new Map<string, EntitySnapshot>();
  const snapAsteroids = new Map<string, EntitySnapshot>();

  for (const ent of snap.entities) {
    if (ent.type === "bullet") {
      addBullet({
        id: ent.id as number,
        x: ent.x,
        y: ent.y,
        px: ent.x,
        py: ent.y,
        vx: ent.vx,
        vy: ent.vy,
        life: 1.0,
        dmg: ent.dmg ?? 0,
        color: ent.color ?? "#ffffff",
        sz: ent.sz ?? 2,
        trail: ent.trail ?? null,
        owner: null,
        kind: toWeaponDelivery(ent.kind),
        weaponId: ent.weaponId ?? null,
        hitChance: ent.hitChance ?? 1,
        targetId: ent.targetId ?? null,
        homingTurnRate: ent.homingTurnRate,
        accel: ent.accel,
        maxSpeed: ent.maxSpeed,
        dmgProfile: toDamageProfile(ent.dmgProfile),
      });
    } else if (ent.type === "enemyBullet") {
      addEnemyBullet({
        id: ent.id as number,
        x: ent.x,
        y: ent.y,
        px: ent.x,
        py: ent.y,
        vx: ent.vx,
        vy: ent.vy,
        life: 1.0,
        dmg: ent.dmg ?? 0,
        color: ent.color ?? "#ff4444",
        sz: ent.sz ?? 2,
        trail: ent.trail ?? null,
        ownerFaction: ent.ownerFaction,
        ownerId: ent.ownerId,
        kind: ent.kind ?? null,
      });
    } else if (ent.type === "wreckpiece") {
      snapWrecks.set(String(ent.id), ent);
    } else if (ent.type === "salvagepickup") {
      snapSalvages.set(String(ent.id), ent);
    } else if (ent.type === "player") {
      snapPlayers.set(String(ent.id), ent);
    } else if (ent.type === "enemy") {
      snapEnemies.set(String(ent.id), ent);
    } else if (ent.type === "asteroid") {
      snapAsteroids.set(String(ent.id), ent);
    }
  }

  // Update existing wreck pieces in-place, remove stale ones
  for (let i = getState().wreckPieces.length - 1; i >= 0; i--) {
    const wp = getState().wreckPieces[i];
    const snapEnt = snapWrecks.get(wp.id);
    if (snapEnt) {
      wp.x = snapEnt.x;
      wp.y = snapEnt.y;
      wp.vx = snapEnt.vx;
      wp.vy = snapEnt.vy;
      wp.angle = snapEnt.angle || 0;
      wp.hp = snapEnt.hp || 10;
      wp.maxHp = snapEnt.maxHp || 10;
      snapWrecks.delete(wp.id);
    } else {
      getState().wreckPieces.splice(i, 1);
    }
  }

  // Add new wreck pieces
  for (const ent of snapWrecks.values()) {
    addWreckPiece({
      id: String(ent.id),
      x: ent.x,
      y: ent.y,
      vx: ent.vx,
      vy: ent.vy,
      angle: ent.angle || 0,
      angularVel: ent.spinVel || 0,
      pts: ent.pts || [],
      radius: ent.radius || 15,
      type: "wreck",
      name: ent.name || "Debris",
      hp: ent.hp || 10,
      maxHp: ent.maxHp || 10,
      age: ent.age || 0,
      despawnTimer: ent.despawnTimer || 10,
      salvagePool: [],
      bob: 0,
      hitFlash: 0,
    });
  }

  // Update existing salvage pickups in-place, remove stale ones
  for (let i = getState().salvagePickups.length - 1; i >= 0; i--) {
    const sp = getState().salvagePickups[i];
    const snapEnt = snapSalvages.get(sp.id);
    if (snapEnt) {
      sp.x = snapEnt.x;
      sp.y = snapEnt.y;
      sp.vx = snapEnt.vx;
      sp.vy = snapEnt.vy;
      sp.qty = snapEnt.qty || 1;
      snapSalvages.delete(sp.id);
    } else {
      if (p && Math.hypot(sp.x - p.x, sp.y - p.y) <= 72) {
        showPickupToast(sp.kind, sp.payload, Math.max(1, sp.qty || 1), sp.instance);
      }
      getState().salvagePickups.splice(i, 1);
    }
  }

  // Add new salvage pickups
  for (const ent of snapSalvages.values()) {
    addSalvagePickup({
      id: String(ent.id),
      x: ent.x,
      y: ent.y,
      vx: ent.vx,
      vy: ent.vy,
      life: 10,
      bob: 0,
      kind: toSalvageKind(ent.kind),
      payload: ent.payload || "scrap",
      qty: ent.qty || 1,
    });
  }

  const peers = getState().players;

  // Update existing remote players in-place, remove stale ones
  for (const [id, peer] of [...peers.entries()]) {
    if (peer === p) continue;
    const snapEnt = snapPlayers.get(id);
    if (snapEnt) {
      peer.x = snapEnt.x;
      peer.y = snapEnt.y;
      peer.vx = snapEnt.vx;
      peer.vy = snapEnt.vy;
      peer.angle = snapEnt.angle || 0;
      peer.hp = snapEnt.hp || 100;
      peer.maxHp = snapEnt.maxHp || 100;
      peer.sysIdx = snap.player.sysIdx;
      if (snapEnt.miningLaser) {
        if (!peer.miningLaser) peer.miningLaser = { active: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0, hitR: 0, hitNx: 0, hitNy: 0 };
        Object.assign(peer.miningLaser, snapEnt.miningLaser);
      } else {
        peer.miningLaser = null;
      }
      if (snapEnt.salvager) {
        if (!peer.salvager) peer.salvager = { active: false, targetPieceId: null, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 };
        Object.assign(peer.salvager, snapEnt.salvager);
      } else {
        peer.salvager = null;
      }
      if (snapEnt.tractor) {
        if (!peer.tractor) peer.tractor = { active: false, targetId: null, tooHeavy: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 };
        Object.assign(peer.tractor, snapEnt.tractor);
      } else {
        peer.tractor = null;
      }
      snapPlayers.delete(id);
    } else {
      PlayerAccess.removeServerPlayer(id);
    }
  }

  // Add new remote players
  for (const ent of snapPlayers.values()) {
    const netId = String(ent.id);
    if (netId === p?.netId) continue;
    const newPeer = makeRemotePlayerStub({
      netId,
      shipId: ent.shipType ?? "scout",
      pilotName: ent.pilotName?.trim() || "Remote Player",
      x: ent.x,
      y: ent.y,
      sysIdx: snap.player.sysIdx,
    } satisfies RemotePlayerBrief);
    PlayerAccess.updatePhysics({ vx: ent.vx, vy: ent.vy, angle: ent.angle || 0, prevAngle: ent.angle || 0 }, newPeer);
    PlayerAccess.setHp(ent.hp || 100, newPeer);
    PlayerAccess.setMaxHp(ent.maxHp || 100, newPeer);
    PlayerAccess.addServerPlayer(newPeer);
  }

  const peerCount = Math.max(0, getState().players.size - 1);
  if (peerCount > 0 && isFullSnapshot) {
    netLog(`snapshot applied remote peers=${peerCount}`);
  }

  if (sys.enemies) {
    for (const e of sys.enemies) {
      const snapEnt = snapEnemies.get(e.id);
      if (snapEnt) {
        e.alive = true;
        e.x = snapEnt.x;
        e.y = snapEnt.y;
        e.vx = snapEnt.vx;
        e.vy = snapEnt.vy;
        e.angle = snapEnt.angle || 0;
        e.hp = snapEnt.hp || 0;
        e.maxHp = snapEnt.maxHp || 100;
      } else {
        e.alive = false;
      }
    }
  }

  if (sys.asteroids) {
    for (const a of sys.asteroids) {
      const snapEnt = snapAsteroids.get(a.id);
      if (snapEnt) {
        a.depleted = !!snapEnt.depleted;
        a.x = snapEnt.x;
        a.y = snapEnt.y;
        a.vx = snapEnt.vx;
        a.vy = snapEnt.vy;
        a.hp = snapEnt.hp || 0;
        a.maxHp = snapEnt.maxHp || 100;
      }
    }
  }
}
