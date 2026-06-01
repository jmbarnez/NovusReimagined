import { PlayerAccess, getState } from "../state-access.js";
import { MODULE_FLAGS, type ModuleDef, type Rack } from "../data/modules.js";
import { floatText } from "../utils/fx.js";
import type { Player } from "../state.js";
import { isAsteroidTarget, isWreckPieceTarget, targetByLockId } from "./lookup.js";
import { ensureLockQueue } from "./locks.js";
import { findFirstWeaponHardpointModule, getFittedHardpointModule, isWeaponHardpointModule } from "./modules.js";

interface AssignTargetOptions {
  silent?: boolean;
  suppressFrameAction?: boolean;
  clearAssign?: boolean;
}

type FittingLayout = Partial<Record<Rack, (string | null)[]>>;

export function getWeaponTurretAtSlot(idx: number, p: Player | null = getState().player): ModuleDef | null {
  if (!p) return null;
  const moduleDef = getFittedHardpointModule(p, idx);
  return moduleDef && isWeaponHardpointModule(moduleDef) ? moduleDef : null;
}

export function resolveWeaponTurret(
  fitting?: FittingLayout,
  p: Player | null = getState().player,
): ModuleDef | null {
  if (!p) return null;
  return findFirstWeaponHardpointModule(p, fitting || p.fitting);
}

function isPlayerObj(obj: unknown): obj is Player {
  return obj !== null && typeof obj === "object" && "shipId" in obj;
}

function isAssignTargetOptions(obj: unknown): obj is AssignTargetOptions {
  if (obj === null || typeof obj !== "object" || isPlayerObj(obj)) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    (candidate.silent === undefined || typeof candidate.silent === "boolean")
    && (candidate.suppressFrameAction === undefined || typeof candidate.suppressFrameAction === "boolean")
    && (candidate.clearAssign === undefined || typeof candidate.clearAssign === "boolean")
  );
}

export function turretModuleAcceptsTarget(m: ModuleDef, targetId: string): boolean {
  if (isAsteroidTarget(targetId)) {
    return !!MODULE_FLAGS.isMiningTurret(m);
  }
  if (isWreckPieceTarget(targetId)) {
    return !!MODULE_FLAGS.isSalvager(m);
  }
  return !!(m.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) && !MODULE_FLAGS.isSalvager(m));
}

export function assignModuleSlotToTarget(
  slotIdx: number,
  targetId: string | null,
  arg3?: unknown,
  arg4?: unknown
): boolean {
  let p: Player = getState().player;
  let opts: AssignTargetOptions = {};

  if (isPlayerObj(arg3)) {
    p = arg3;
    if (isAssignTargetOptions(arg4)) opts = arg4;
  } else if (isAssignTargetOptions(arg3)) {
    opts = arg3;
    if (isPlayerObj(arg4)) {
      p = arg4;
    }
  } else if (isPlayerObj(arg4)) {
    p = arg4;
  }

  if (targetId === null) {
    if (p === getState().player) {
      PlayerAccess.setTurretTarget(slotIdx, null);
    } else {
      if (!p.turretTargets) p.turretTargets = [];
      p.turretTargets[slotIdx] = null;
    }
    return true;
  }

  ensureLockQueue(p);

  const lockSlot = p.lockQueue.find((s) => s.id === targetId);
  if (!lockSlot) {
    if (!opts?.silent && typeof window !== "undefined" && p === getState().player) {
      floatText(p.x, p.y - 30, "TARGET NOT LOCKED", "#ff8844");
    }
    return false;
  }

  const target = targetByLockId(targetId, p);
  if (!target) return false;

  const m = getFittedHardpointModule(p, slotIdx);
  if (!m) return false;

  if (!turretModuleAcceptsTarget(m, targetId)) {
    if (!opts?.silent && typeof window !== "undefined" && p === getState().player) {
      floatText(p.x, p.y - 30, "INVALID TARGET TYPE", "#ff8844");
    }
    return false;
  }

  if (p === getState().player) {
    PlayerAccess.setTurretTarget(slotIdx, targetId);
  } else {
    if (!p.turretTargets) p.turretTargets = [];
    p.turretTargets[slotIdx] = targetId;
  }
  return true;
}
