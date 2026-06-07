import { type Player } from "../state.js";
import { netLog } from "../ui/net-console.js";
import { LOCAL_PLAYER_ID } from "../player-registry.js";
import { PlayerAccess, getState } from "../state-access.js";
import { makeDefaultAlloyCodex, makeDefaultRefineryStorage } from "../refining.js";

export interface RemotePlayerBrief {
  netId: string;
  shipId: string;
  pilotName?: string;
  x: number;
  y: number;
  sysIdx: number;
}

export function makeRemotePlayerStub(brief: RemotePlayerBrief): Player {
  return {
    netId: brief.netId,
    shipId: brief.shipId,
    pilotName: brief.pilotName ?? "",
    homeSysIdx: brief.sysIdx,
    pendingHomeSpawn: false,
    x: brief.x,
    y: brief.y,
    px: brief.x,
    py: brief.y,
    vx: 0,
    vy: 0,
    va: 0,
    angle: 0,
    prevAngle: 0,
    hp: 100,
    maxHp: 100,
    structure: 100,
    maxStructure: 100,
    shield: 50,
    shieldCd: 0,
    shieldHitGlow: 0,
    shieldHitAngle: 0,
    hullHitGlow: 0,
    hullHitAngle: 0,
    targetLock: null,
    lockQueue: [],
    fireControlSlot: 0,
    turretTargets: [],
    highTargets: [],
    turretCds: [],
    turretPower: [],
    turretPowerCd: [],
    combatBar: { pos: 0, dir: 1 },
    energy: 100,
    sysIdx: brief.sysIdx,
    credits: 0,
    ore: {},
    mixedOreCargo: [],
    bulkMaterialsCargo: [],
    loot: {},
    components: {},
    ammo: { hybrid: 0, missile: 0 },
    moduleCargo: [],
    blueprints: {},
    skills: {},
    skillXp: {},
    xp: 0,
    level: 1,
    kills: 0,
    shootCd: 0,
    mineCd: 0,
    invincible: 0,
    thrustFx: false,
    boostFx: false,
    boostLockout: false,
    fitting: { turret: [], high: [], med: [], low: [] },
    moduleHp: {},
    slotActive: { turret: [], high: [], med: [], low: [] },
    _assignTargetId: null,
    contracts: [],
    stationOffers: [],
    stationOfferStationId: null,
    craftQueue: [],
    hubQueue: [],
    hubOutput: { loot: {}, ore: {}, materials: [], modules: [] },
    hubDeposit: { raw: [], ore: {}, materials: [], loot: {}, modules: [] },
    refineryStorage: makeDefaultRefineryStorage(),
    alloyCodex: makeDefaultAlloyCodex(),
    tutorial: { active: false, step: 0, completed: false, skipped: false },
    gateCooldowns: {},
    gatesCleared: [],
    detectedSignatures: [],
    scannedSiteIds: [],
    completedSiteIds: [],
    scannerAngle: 0,
    scannerConeDeg: 180,
    mapScannerActive: false,
    mapScannerStrength: 0,
    activeScan: null,
    discoveredConcentricSectors: [],
    discoveredLocalRegionIds: [],
    warpCooldown: 0,
    warpTargetIdx: -1,
  };
}

export function upsertRemotePlayerPeer(brief: RemotePlayerBrief) {
  if (!getState().player || brief.netId === getState().player.netId) return;
  const existing = getState().players.get(brief.netId);
  if (existing) {
    existing.shipId = brief.shipId;
    const nextName = brief.pilotName?.trim();
    if (nextName) existing.pilotName = nextName;
    existing.x = existing.px = brief.x;
    existing.y = existing.py = brief.y;
    existing.sysIdx = brief.sysIdx;
    return;
  }
  PlayerAccess.addServerPlayer(makeRemotePlayerStub(brief));
  netLog(
    `peer joined ${brief.netId} ship=${brief.shipId} @ (${brief.x.toFixed(0)},${brief.y.toFixed(0)}) sys=${brief.sysIdx}`,
  );
}

export function removeRemotePlayerPeer(netId: string) {
  if (netId === LOCAL_PLAYER_ID || getState().player?.netId === netId) return;
  if (getState().players.has(netId)) {
    PlayerAccess.removeServerPlayer(netId);
    netLog(`peer left ${netId}`);
  }
}
