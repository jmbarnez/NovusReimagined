import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { emit } from "../events.js";
import { savePlayer } from "../player/player-data.js";
import { addParticle, clearSimulationEntities } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { allActivePlayers, curSys } from "../utils/game.js";
import { GATE_RANGE, WARP_TIME } from "../constants.js";
import { clearSensorLocks } from "../targeting.js";
import { floatText } from "../utils/fx.js";
import { populateSystem } from "../world-gen.js";
import { stationLayer } from "../pixi.js";
import { initPixiCelestial, destroyPixiCelestial } from "../render/celestial/index.js";
import { initGateSprites } from "../render/celestial/gates.js";
import type { Gate } from "../types/world.js";
import { canWarpThroughGate, shouldShowWarpGate } from "../data/tutorial.js";
import { didCrossGateAperture, gateDestinationName } from "../utils/warp-gates.js";

function logDockEvent(msg: string, type: string = "system"): void {
  if (typeof window === "undefined") return;
  void import("../ui/hud-overlay.js")
    .then((m) => m.logEvent(msg, type))
    .catch(() => {
      // Ignore UI logging failures in non-UI runtimes.
    });
}

function playWarpAudio(kind: "charge" | "jump"): void {
  if (typeof window === "undefined") return;
  void import("../audio/procedural.js")
    .then((m) => {
      if (kind === "charge") m.sfxWarpCharge();
      else m.sfxWarpJump();
    })
    .catch(() => {
      // Ignore audio init failures in headless runtimes.
    });
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
  PlayerAccess.setWarpCooldown(2.5, p);
  PlayerAccess.setWarpTargetIdx(-1, p);
  PlayerAccess.updatePhysics({
    x: gate.target.x,
    y: gate.target.y - 320,
    px: gate.target.x,
    py: gate.target.y - 320,
    vx: 0,
    vy: 0,
  }, p);
  PlayerAccess.setInvincible(1.5, p);
  clearSensorLocks(p);
  if (crossSys && typeof gate.targetSysIdx === "number") {
    PlayerAccess.setSysIdx(gate.targetSysIdx, p);
    const targetSys = getState().GALAXY[gate.targetSysIdx];
    if (targetSys && !targetSys._ready) {
      populateSystem(targetSys);
    }
    if (p === getState().player) {
      emit("sector:crossed", { toIdx: gate.targetSysIdx });
      destroyPixiCelestial();
      if (targetSys && stationLayer) initPixiCelestial(stationLayer, targetSys);
    }
  }
  if (p === getState().player) {
    const actionLabel = crossSys ? `WARPED TO ${gate.target.label.toUpperCase()}` : `RETURNED TO ${gate.target.label.toUpperCase()}`;
    floatText(p.x, p.y - 55, actionLabel, "#66aaff");
    playWarpAudio("jump");
    logDockEvent(crossSys ? `Warped to ${gate.target.label}` : `Returned to ${gate.target.label}`, "system");
    savePlayer();
  }
}

export function beginWarpThroughGate(gate: Gate, p: Player = getState().player): boolean {
  const sys = curSys(p);
  if (!sys) return false;
  if ((p.warpCooldown ?? 0) > 0) return false;
  if (!shouldShowWarpGate(gate, sys.idx, p)) return false;
  if (!canWarpThroughGate(gate, sys.idx, p)) return false;
  gate.gateState = "warping";
  gate.chargeProgress = 1;
  spawnGateWarpBurst(gate, p);
  PlayerAccess.setWarpCooldown(WARP_TIME, p);
  if (typeof gate.targetSysIdx === "number") {
    PlayerAccess.setWarpTargetIdx(gate.targetSysIdx, p);
  }
  if (p === getState().player) {
    floatText(p.x, p.y - 45, `WARP to ${gate.target.label}`, "#66aaff");
    playWarpAudio("charge");
  }
  return true;
}

const ACTIVATION_RADIUS_MULT = 2.0;
const CHARGE_TIME = 2.0;
const DISPENSE_LIFETIME = 3.0;

function createTemporaryGate(sysIdx: number, x: number, y: number, fromIdx: number): void {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return;

  // Check if gate already exists at this location
  const existingGate = sys.gates?.find(g =>
    Math.hypot(g.x - x, g.y - y) < 10 && g.target.label === `from-${fromIdx}`
  );
  if (existingGate) return;

  // Create temporary gate
  const tempGate: Gate = {
    x,
    y,
    px: x,
    py: y,
    target: {
      kind: "local",
      x: 0,
      y: 0,
      label: `from-${fromIdx}`,
    },
    radius: 60,
    spin: 0,
    gateState: "active",
    chargeProgress: 1,
    dispenseTimer: DISPENSE_LIFETIME,
    isTemporary: true,
  };
  
  if (!sys.gates) sys.gates = [];
  sys.gates.push(tempGate);
  
  // Particle burst on dispense gate spawn
  if (getState().player.sysIdx === sysIdx) {
    for (let i = 0; i < 24; i++) {
      const a = random() * Math.PI * 2;
      const r = 30 + random() * 40;
      const sp = 150 + random() * 100;
      addParticle({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + random() * 0.4,
        color: "#aaddff",
        r: 1 + random() * 1.5,
        drag: 0.1,
      });
    }
  }
  
  // Reinitialize gate sprites if this is the current system
  if (getState().player.sysIdx === sysIdx && getState().player === getState().player) {
    initGateSprites(sys);
  }
}

export function updateGateActivation(dt: number, p: Player): void {
  const sys = curSys(p);
  if (!sys) return;

  for (const gate of sys.gates ?? []) {
    if (gate.isTemporary) {
      // Update dispense timer
      if (gate.dispenseTimer !== undefined && gate.dispenseTimer !== null) {
        gate.dispenseTimer -= dt;
        if (gate.dispenseTimer <= 0) {
          // Remove temporary gate (handled by system repopulation)
          gate.dispenseTimer = null;
        }
      }
      continue;
    }

    // Skip gates that are in warping state - proximity logic shouldn't override
    if (gate.gateState === "warping") continue;

    // Initialize state if not set
    if (!gate.gateState) gate.gateState = "dormant";
    if (gate.chargeProgress === undefined) gate.chargeProgress = 0;

    // Check if G is being held and player is in range
    const isHoldingWarp = Client.keys["warp"] === true;
    const dist = Math.hypot(p.x - gate.x, p.y - gate.y);
    const inRange = dist < gate.radius * ACTIVATION_RADIUS_MULT;

    if (inRange && isHoldingWarp && (p.warpCooldown ?? 0) <= 0) {
      // Start charging
      if (gate.gateState === "dormant") {
        gate.gateState = "charging";
        p.warpHoldStartTime = performance.now();
      }

      if (gate.gateState === "charging") {
        gate.chargeProgress += dt / CHARGE_TIME;
        if (gate.chargeProgress >= 1) {
          gate.chargeProgress = 1;
          gate.gateState = "active";
          // Auto-warp when fully charged
          beginWarpThroughGate(gate, p);
        }
      }
    } else {
      // Reset if not holding G or out of range
      if (gate.gateState !== "dormant") {
        gate.gateState = "dormant";
        gate.chargeProgress = 0;
        p.warpHoldStartTime = null;
      }
    }
  }
}

function tickPlayerWarp(dt: number, p: Player): void {
  // Update gate activation states
  updateGateActivation(dt, p);

  if ((p.warpCooldown ?? 0) > 0) {
    PlayerAccess.setWarpCooldown((p.warpCooldown ?? 0) - dt, p);
    if ((p.warpCooldown ?? 0) <= 0) {
      PlayerAccess.setWarpCooldown(0, p);
      // Find warping gate and execute warp
      const sourceSys = curSys(p);
      if (sourceSys) {
        for (const gate of sourceSys.gates ?? []) {
          if (gate.gateState === "warping") {
            gate.gateState = "dormant";
            gate.chargeProgress = 0;
            warpTo(gate, p);
            break;
          }
        }
      }
      PlayerAccess.setWarpTargetIdx(-1, p);
    }
    return;
  }

  // Pass-through logic removed - warp only via hold-to-charge
}

export function updateWarp(dt: number): void {
  for (const p of allActivePlayers()) tickPlayerWarp(dt, p);
}
