import { G, Client } from "./state.js";
import { MODULES, MODULE_FLAGS } from "./data/modules.js";
import { getInstance } from "./utils/items.js";
import type { WreckPiece, LockSlot } from "./types/world.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { isWreckPieceTarget } from "./targeting.js";
import { addSkillXp } from "./player/player-data.js";
import { damageWreckPiece } from "./wreck.js";
import { sfxIndustrialBeam } from "./audio/procedural.js";

export const SALVAGE_RANGE = 350;
const SALVAGE_DPS = 4;       // slow, deliberate beam — not a weapon
const XP_PER_PIECE = 35;
const BEAM_SFX_INTERVAL = 0.5;
let _beamSfxTimer = 0;

function findSalvagerSlot(): { idx: number; rollBonus: number } | null {
  const turrets = G.P.fitting.turret;
  if (!turrets) return null;
  let rollBonus = 0;
  let firstIdx = -1;
  for (let i = 0; i < turrets.length; i++) {
    const uid = turrets[i];
    if (!uid) continue;
    const inst = getInstance(uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m || !MODULE_FLAGS.isSalvager(m)) continue;
    // Turrets use turretPower, not slotActive
    const powered = G.P.turretPower?.[i] ?? false;
    if (powered) {
      rollBonus += m.salvageRollBonus ?? 0;
      if (firstIdx === -1) firstIdx = i;
    }
  }
  return firstIdx >= 0 ? { idx: firstIdx, rollBonus } : null;
}

function resolveAssignedPiece(slotIdx: number): WreckPiece | null {
  const assignedId = G.P.turretTargets?.[slotIdx];
  if (!assignedId || !isWreckPieceTarget(assignedId)) return null;

  const lockSlot = G.P.lockQueue?.find((s: LockSlot) => s.id === assignedId);
  if (!lockSlot || lockSlot.resolving) return null;

  const piece = G.wreckPieces.find((p) => p.id === assignedId);
  if (!piece || piece.hp <= 0) return null;
  if (dst(G.P.x, G.P.y, piece.x, piece.y) > SALVAGE_RANGE) return null;

  return piece;
}

export function updateSalvager(dt: number) {
  const sv = G.salvager;

  const slot = findSalvagerSlot();
  if (!slot) {
    sv.active = false;
    sv.targetPieceId = null;
    return;
  }
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) {
    sv.active = false;
    return;
  }

  const piece = resolveAssignedPiece(slot.idx);
  if (!piece) {
    sv.active = false;
    sv.targetPieceId = null;
    return;
  }

  // Capacitor drain
  const uid = G.P.fitting.turret[slot.idx]!;
  const inst = getInstance(uid);
  const mod = inst ? MODULES[inst.baseId] : null;
  const drain = (mod?.capDrainPerSec ?? 2) * dt;
  if (G.P.energy < drain) {
    sv.active = false;
    floatText(G.P.x, G.P.y - 35, "No cap", "#ff8844");
    return;
  }
  G.P.energy -= drain;

  sv.active = true;
  sv.targetPieceId = piece.id;
  sv.x1 = G.P.x;
  sv.y1 = G.P.y;
  sv.x2 = piece.x;
  sv.y2 = piece.y;
  sv.phase += dt * 6;

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

export function getSalvagerBeam() {
  return G.salvager;
}
