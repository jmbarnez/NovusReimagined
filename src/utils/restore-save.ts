import { Client, type Player } from "../state.js";
import { WorldAccess, PlayerAccess, getState } from "../state-access.js";
import { SAVE_KEY } from "../constants.js";
import { C } from "../config/index.js";
import { clearTransientPlayerInput, loadPlayer, makePlayer } from "../player/player-data.js";
import { computeStats } from "../player/player-stats.js";
import { validateFitting } from "../player/player-fitting.js";
import { populateSystem } from "../world-gen.js";
import { getNovusPrimeIdx } from "../world/galaxy-build.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { getInstance } from "./items.js";
import { clearSimulationEntities } from "./entities.js";
import { initTutorial } from "../tutorial/index.js";
import { initTutorialOverlay } from "../ui/tutorial-overlay.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { spawnNearFirstStation, setupPlayerSpawn } from "./player-spawn.js";
import { hideTutorialOverlay } from "../ui/tutorial-overlay.js";
import { netLog } from "../ui/net-console.js";

function redirectCompletedTutorialPlayer(): boolean {
  if (!getState().player.tutorial.active && getState().player.tutorial.completed) {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx >= 0) {
      PlayerAccess.setSysIdx(primeIdx);
      PlayerAccess.setHomeSysIdx(primeIdx);
      return true;
    }
  }
  return false;
}

export function ensurePlayerHasWeapon() {
  validateFitting();
  const hpRack = playerHardpointRack(getState().player);
  const hpSlots = getState().player.fitting[hpRack] ?? [];
  const hasWeapon = hpSlots.some((uid: string | null) => {
    if (!uid) return false;
    const inst = getInstance(uid, getState().player);
    if (!inst) return false;
    const m = MODULES[inst.baseId];
    return m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
  });
  if (!hasWeapon) {
    const firstEmpty = hpSlots.findIndex((id: string | null) => id === null);
    if (firstEmpty >= 0) {
      const fallbackUid = `${C.SPAWNING.FALLBACK_WEAPON.uidPrefix}-${Date.now()}`;
      PlayerAccess.addModuleCargo({
        uid: fallbackUid,
        baseId: C.SPAWNING.FALLBACK_WEAPON.moduleBaseId,
        rarity: ModuleRarity.Stock,
        itemLevel: C.SPAWNING.FALLBACK_WEAPON.itemLevel,
        durability: C.SPAWNING.FALLBACK_WEAPON.durability,
        maxDurability: C.SPAWNING.FALLBACK_WEAPON.maxDurability,
        affixes: [],
      });
      PlayerAccess.setFittingSlot(hpRack, firstEmpty, fallbackUid);
      validateFitting();
    }
  }
}

export function clampPlayerVitals() {
  if (getState().player.hp > getState().player.maxHp) PlayerAccess.setHp(getState().player.maxHp);
  if (getState().player.structure > getState().player.maxStructure) PlayerAccess.setStructure(getState().player.maxStructure);
  if (getState().player.structure < 0) PlayerAccess.setStructure(0);
}

export interface InitGameSessionOpts {
  clearSim?: boolean;
  redirectTutorial?: boolean;
  setupSpawn?: boolean;
  spawnNearStationIfRedirected?: boolean;
  setPendingHomeSpawnFalse?: boolean;
  tutorialOverlay?: boolean;
}

/** Shared initialization sequence used by every gameplay entry path. */
export function initGameSession(player: Player, opts: InitGameSessionOpts = {}): void {
  if (opts.clearSim) clearSimulationEntities();

  clearTransientPlayerInput(player);
  WorldAccess.initPlayer(player);

  let redirected = false;
  if (opts.redirectTutorial) {
    redirected = redirectCompletedTutorialPlayer();
  }

  const sysIdx = player.sysIdx || 0;
  if (!getState().GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
  const sys = getState().GALAXY[player.sysIdx];
  if (sys && !sys._ready) populateSystem(sys);

  if (opts.spawnNearStationIfRedirected && redirected) {
    spawnNearFirstStation(player, getState().GALAXY, player.sysIdx);
    PlayerAccess.updatePhysics({ x: player.x, y: player.y, px: player.px, py: player.py });
  }

  if (opts.setupSpawn) {
    setupPlayerSpawn(player, getState().GALAXY);
    PlayerAccess.updatePhysics({ x: player.x, y: player.y, px: player.px, py: player.py });
  }

  if (opts.setPendingHomeSpawnFalse) {
    PlayerAccess.setPendingHomeSpawn(false);
  }

  ensurePlayerHasWeapon();
  computeStats(player);
  clampPlayerVitals();

  Client.camx = player.x;
  Client.camy = player.y;

  if (opts.tutorialOverlay ?? player.tutorial.active) {
    initTutorial();
    initTutorialOverlay(true);
  } else {
    hideTutorialOverlay();
    initTutorialOverlay(false);
  }
}

/** Reload player and current system from localStorage (title Continue / pause Load). */
export function restoreGameFromSave(): boolean {
  if (!localStorage.getItem(SAVE_KEY)) return false;

  const loaded = loadPlayer();
  initGameSession(loaded, {
    clearSim: true,
    redirectTutorial: true,
    spawnNearStationIfRedirected: true,
  });

  return true;
}

/** Load the local pilot for a remote join — no solo tutorial UI. */
export function prepareRemoteJoinPilot(): void {
  netLog("prepareRemoteJoinPilot: loading pilot for remote join");

  let isLocalHostActive = false;
  if (typeof localStorage !== "undefined") {
    const hostActiveRaw = localStorage.getItem("ss2-host-active");
    if (hostActiveRaw) {
      const hostTime = parseInt(hostActiveRaw, 10);
      if (!isNaN(hostTime) && Date.now() - hostTime < 10000) {
        isLocalHostActive = true;
      }
    }
  }

  if (isLocalHostActive) {
    netLog("prepareRemoteJoinPilot: active local host detected. Using fresh pilot to avoid same-machine save collision.");
  }

  const player = (localStorage.getItem(SAVE_KEY) && !isLocalHostActive) ? loadPlayer() : makePlayer();
  if (!localStorage.getItem(SAVE_KEY) || isLocalHostActive) {
    netLog("prepareRemoteJoinPilot: initialized fresh player");
  }

  initGameSession(player, {
    clearSim: true,
    redirectTutorial: true,
    setupSpawn: true,
    setPendingHomeSpawnFalse: true,
  });

  if (player.tutorial.active) {
    netLog("prepareRemoteJoinPilot: tutorial active for remote join");
  }
  netLog(`prepareRemoteJoinPilot done sys=${player.sysIdx} pos=(${player.x.toFixed(0)},${player.y.toFixed(0)})`);
}
