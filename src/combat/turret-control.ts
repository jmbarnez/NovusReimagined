import { Client, isGameplayPaused, type Player } from "../state.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { isSlotOnline } from "../utils/slot-power.js";
import { PlayerAccess, getState } from "../state-access.js";
import { floatText } from "../utils/fx.js";
import { t } from "../utils/i18n.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { C } from "../config/index.js";
import { playerShoot } from "./player-shoot.js";

function isTurretReady(idx: number, p: Player): boolean {
  return isSlotOnline(playerHardpointRack(p), idx, p);
}

export function fireSelectedTurret(p: Player = getState().player) {
  if (isGameplayPaused()) return;
  if (p === getState().player && (Client.showMap || Client.bridgeOpen)) return;
  const slot = p.fireControlSlot ?? 0;
  const rack = playerHardpointRack(p);
  const uid = p.fitting?.[rack]?.[slot];
  const inst = uid ? p.moduleCargo.find(item => item.uid === uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m || MODULE_FLAGS.isMiningTurret(m) || !m.weaponDelivery) return;
  if (!isTurretReady(slot, p)) {
    if (typeof window !== "undefined") floatText(p.x, p.y - 32, t("combat.turretOffline"), "#ff6644");
    return;
  }
  playerShoot(slot, null, p);
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

}
