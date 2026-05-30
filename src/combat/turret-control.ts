import { Client, isGameplayPaused, type Player } from "../state.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { isSlotOnline } from "../utils/slot-power.js";
import { PlayerAccess, getState } from "../state-access.js";
import { dst } from "../utils/math.js";
import { floatText } from "../utils/fx.js";
import { targetByLockId } from "../targeting.js";
import { getWeaponProfileForSlot } from "../player/player-stats.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { C } from "../config/index.js";
import { playerShoot } from "./player-shoot.js";

function isTurretReady(idx: number, p: Player): boolean {
  return isSlotOnline(playerHardpointRack(p), idx, p);
}

export function fireSelectedTurret(isAutoFire = false, p: Player = getState().player) {
  if (isGameplayPaused()) return;
  if (p === getState().player && (Client.showMap || Client.bridgeOpen)) return;
  const slot = p.fireControlSlot ?? 0;
  const rack = playerHardpointRack(p);
  const uid = p.fitting?.[rack]?.[slot];
  const inst = uid ? p.moduleCargo.find(item => item.uid === uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m || MODULE_FLAGS.isMiningTurret(m) || !m.weaponDelivery) return;
  if (!isTurretReady(slot, p)) {
    if (!isAutoFire && typeof window !== "undefined") floatText(p.x, p.y - 32, "TURRET OFFLINE", "#ff6644");
    return;
  }
  playerShoot(slot, null, isAutoFire, p);
}

export function updateTurretCooldowns(dt: number, p: Player = getState().player) {
  if (isGameplayPaused()) return;
  if (p === getState().player && (Client.showMap || Client.bridgeOpen)) return;
  const n = p.turretCds?.length || 0;
  for (let i = 0; i < n; i++) {
    const val = p.turretCds[i] || 0;
    if (val > 0) {
      PlayerAccess.setTurretCd(i, val - dt, p);
    }
  }

  const hpRack = playerHardpointRack(p);
  const hpSlots = p.fitting?.[hpRack] || [];
  for (let i = 0; i < hpSlots.length; i++) {
    const uid = hpSlots[i];
    if (!uid) continue;
    const inst = p.moduleCargo.find(item => item.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m)) continue;
    if (!isTurretReady(i, p)) continue;
    if ((p.turretCds?.[i] || 0) > 0) continue;

    const assignedId = p.turretTargets?.[i];
    if (!assignedId) continue;

    const lockSlot = p.lockQueue?.find((s) => s.id === assignedId && !s.resolving);
    if (!lockSlot) continue;

    const target = targetByLockId(assignedId, p);
    if (!target) continue;

    const dist = dst(p.x, p.y, target.x, target.y);
    const wProf = getWeaponProfileForSlot(i, p);
    if (!wProf || dist > wProf.range * C.COMBAT.TURRET_RANGE_OVERSHOOT) continue;

    playerShoot(i, target, true, p);
  }
}
