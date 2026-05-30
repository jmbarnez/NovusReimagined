import { Client } from "./state.js";
import { getState, PlayerAccess, SalvagerAccess } from "./state-access.js";
import { MODULES, MODULE_FLAGS } from "./data/modules.js";
import { getInstance } from "./utils/items.js";
import type { WreckPiece, LockSlot } from "./types/world.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { isWreckPieceTarget } from "./targeting.js";
import { addSkillXp } from "./player/player-data.js";
import { damageWreckPiece } from "./wreck.js";
import { sfxIndustrialBeam } from "./audio/procedural.js";
import { forEachFittedModuleSlot, getFittedModuleDef, isModuleSlotPowered } from "./utils/module-slots.js";
import type { AssignableRack } from "./utils/module-slots.js";

export const SALVAGE_RANGE = 350;
const SALVAGE_DPS = 4;       // slow, deliberate beam — not a weapon
const XP_PER_PIECE = 35;
const BEAM_SFX_INTERVAL = 0.5;
let _beamSfxTimer = 0;

function findSalvagerSlot(): { rack: AssignableRack; idx: number; rollBonus: number } | null {
  let rollBonus = 0;
  let firstRack: AssignableRack | null = null;
  let firstIdx = -1;
  forEachFittedModuleSlot(MODULE_FLAGS.isSalvager, (ref, mod) => {
    if (!isModuleSlotPowered(ref.rack, ref.idx, getState().player)) return;
    rollBonus += mod.salvageRollBonus ?? 0;
    if (firstIdx === -1) {
      firstRack = ref.rack;
      firstIdx = ref.idx;
    }
  }, getState().player);
  return firstRack && firstIdx >= 0 ? { rack: firstRack, idx: firstIdx, rollBonus } : null;
}

function resolveAssignedPiece(slotIdx: number): WreckPiece | null {
  const assignedId = getState().player.turretTargets?.[slotIdx];
  if (!assignedId || !isWreckPieceTarget(assignedId)) return null;

  const lockSlot = getState().player.lockQueue?.find((s: LockSlot) => s.id === assignedId);
  if (!lockSlot || lockSlot.resolving) return null;

  const piece = getState().wreckPieces.find((p) => p.id === assignedId);
  if (!piece || piece.hp <= 0) return null;
  if (dst(getState().player.x, getState().player.y, piece.x, piece.y) > SALVAGE_RANGE) return null;

  return piece;
}

export function updateSalvager(dt: number) {
  const sv = getState().salvager;
  if (!sv) {
    SalvagerAccess.update({ active: false, targetPieceId: null, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 });
  }

  const slot = findSalvagerSlot();
  if (!slot) {
    SalvagerAccess.update({ active: false, targetPieceId: null });
    return;
  }
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) {
    SalvagerAccess.update({ active: false });
    return;
  }

  const piece = resolveAssignedPiece(slot.idx);
  if (!piece) {
    SalvagerAccess.update({ active: false, targetPieceId: null });
    return;
  }

  // Capacitor drain
  const mod = getFittedModuleDef(slot.rack, slot.idx, getState().player);
  const drain = (mod?.capDrainPerSec ?? 2) * dt;
  if (getState().player.energy < drain) {
    SalvagerAccess.update({ active: false });
    floatText(getState().player.x, getState().player.y - 35, "No cap", "#ff8844");
    return;
  }
  PlayerAccess.setEnergy(getState().player.energy - drain);

  SalvagerAccess.update({
    active: true,
    targetPieceId: piece.id,
    x1: getState().player.x,
    y1: getState().player.y,
    x2: piece.x,
    y2: piece.y,
    phase: (getState().salvager?.phase ?? 0) + dt * 6,
  });

  // Throttled beam hum
  _beamSfxTimer -= dt;
  if (_beamSfxTimer <= 0) {
    sfxIndustrialBeam("salvage", piece.x, piece.y);
    _beamSfxTimer = BEAM_SFX_INTERVAL;
  }

  const dps = SALVAGE_DPS * (1 + slot.rollBonus * 0.6);
  const wasAlive = piece.hp > 0;
  damageWreckPiece(piece, dps * dt);
  if (wasAlive && piece.hp <= 0) {
    addSkillXp("salvage", XP_PER_PIECE);
  }
}

export function getSalvagerBeam(p = getState().player) {
  return p?.salvager ?? getState().salvager;
}
