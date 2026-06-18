import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { emit } from "../events.js";
import { savePlayer } from "../player/player-data.js";
import { addParticle } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { curSys } from "../utils/game.js";
import { clearSensorLocks } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { t } from "../utils/i18n.js";
import { populateSystem } from "../world-gen.js";
import { stationLayer } from "../pixi.js";
import { initPixiCelestial, destroyPixiCelestial } from "../render/celestial/index.js";
import { clearVisualState } from "../render/entity-visuals.js";
import { clearAiState } from "../physics/npcs/ai-state.js";
import { clearTaskState } from "../physics/npcs/task-state.js";
import { clearNpcSpeech } from "../render/npc-speech.js";
import { clearPlayerInput } from "../player/input-state.js";
import { clearCollisionCooldowns } from "../player/collision-state.js";
import { clearAssignTargetIds } from "../player/target-selection.js";
import type { Gate } from "../types/station.js";
import { canWarpThroughGate, shouldShowWarpGate } from "../data/tutorial.js";
import { C } from "../config/index.js";

function logDockEvent(msg: string, type: string = "system"): void {
  if (typeof window === "undefined") return;
  void import("../ui/hud-overlay.js")
    .then((m) => m.logEvent(msg, type))
    .catch(() => {});
}

function playWarpAudio(kind: "charge" | "jump"): void {
  if (typeof window === "undefined") return;
  void import("../audio/procedural.js")
    .then((m) => {
      if (kind === "charge") m.sfxWarpCharge();
      else m.sfxWarpJump();
    })
    .catch(() => {});
}

function spawnGateWarpBurst(gate: Gate, p: Player): void {
  if (p !== getState().player) return;
  const travelAngle = Math.atan2(p.y - p.py, p.x - p.px);
  const baseAngle = Number.isFinite(travelAngle) ? travelAngle : p.angle;
  for (let i = 0; i < 32; i++) {
    const a = baseAngle + (random() - 0.5) * 0.9;
    const r = gate.radius * (0.25 + random() * 0.7);
    const theta = random() * Math.PI * 2;
    const sp = 200 + random() * 100;
    addParticle({
      x: gate.x + Math.cos(theta) * r,
      y: gate.y + Math.sin(theta) * r,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + random() * 0.3,
      color: "#aaddff",
      r: 1 + random() * 1,
      drag: 0.08,
    });
  }
}

export function warpTo(gate: Gate, p: Player = getState().player) {
  const crossSys = gate.targetSysIdx !== undefined && gate.targetSysIdx !== null;
  PlayerAccess.setWarpCooldown(0.3, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
  PlayerAccess.updatePhysics(
    {
      x: gate.target.x,
      y: gate.target.y - 320,
      px: gate.target.x,
      py: gate.target.y - 320,
      vx: 0,
      vy: 0,
    },
    p,
  );
  PlayerAccess.setInvincible(1.5, p);
  clearSensorLocks(p);
  if (crossSys && typeof gate.targetSysIdx === "number") {
    PlayerAccess.setSysIdx(gate.targetSysIdx, p);
    const targetSys = getState().GALAXY[gate.targetSysIdx];
    if (targetSys && !targetSys.ready) {
      populateSystem(targetSys);
    }
    if (p === getState().player) {
      emit("sector:crossed", { toIdx: gate.targetSysIdx });
      destroyPixiCelestial();
      clearVisualState();
      clearAiState();
      clearTaskState();
      clearNpcSpeech();
      clearPlayerInput();
      clearCollisionCooldowns();
      clearAssignTargetIds();
      if (targetSys && stationLayer) initPixiCelestial(stationLayer, targetSys);
    }
  }
  if (p === getState().player) {
    const actionLabel = crossSys
      ? t("system.warpedFloat", { label: gate.target.label.toUpperCase() })
      : t("system.returnedFloat", { label: gate.target.label.toUpperCase() });
    floatText(p.x, p.y - 55, actionLabel, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(crossSys ? t("system.warpedTo", { label: gate.target.label }) : t("system.returnedTo", { label: gate.target.label }), "system");
    savePlayer();
  }
}

export function beginWarpThroughGate(gate: Gate, p: Player = getState().player): boolean {
  const sys = curSys(p);
  if (!sys) return false;
  if ((p.warpCooldown ?? 0) > 0) return false;
  if (!shouldShowWarpGate(gate, sys.idx, p)) return false;
  if (!canWarpThroughGate(gate, sys.idx, p)) return false;

  warpTo(gate, p);

  gate.gateState = "cooldown";
  gate.cooldownTimer = C.WORLD.GATES.cooldownTimeBase;
  gate.chargeProgress = 1;
  spawnGateWarpBurst(gate, p);
  return true;
}
