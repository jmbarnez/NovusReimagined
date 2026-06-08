import { Client, type Player } from "../state.js";
import { getState, PlayerAccess } from "../state-access.js";
import { applyInputFrameToPlayer } from "../sim/input.js";
import { updateShip } from "../physics/ship.js";
import { updateTutorialTrack } from "../physics/tutorial-track.js";
import { tickAbilities } from "../player/abilities.js";
import { replayPredictedToggleSlotAction } from "../player/player-fitting.js";
import {
  assignModuleSlotToTarget,
  clearSensorLocks,
  removeSensorLock,
  requestSensorLock,
  selectLockTarget,
} from "../targeting.js";
import type { InputFrame } from "../sim/input.js";
import type { WorldSnapshot } from "../sim/snapshot.js";
import { TICK_DT } from "../constants.js";
import { updateCombat } from "../physics/combat-physics.js";
import { startScanPulse } from "../scanning/index.js";

// PredictionManager class: Maintains unacknowledged local input frames
// and replays them on top of incoming server snapshots to reconcile state.
export class PredictionManager {
  private unackInputs: InputFrame[] = [];
  private lastServerTick = -1;
  private errorX = 0;
  private errorY = 0;

  public addInput(frame: InputFrame) {
    this.unackInputs.push(frame);

    // Predict movement for this tick immediately on the client
    this.predictFrame(frame);
  }

  public reconcile(snap: WorldSnapshot) {
    if (snap.tick <= this.lastServerTick) return;
    this.lastServerTick = snap.tick;

    // Discard acknowledged input frames
    this.unackInputs = this.unackInputs.filter(f => f.tick > snap.tick);

    const local = getState().player;
    if (!local) return;
    // Replay remaining unacknowledged inputs to catch up from server tick to current predicted tick
    const oldSpace = Client.keys[" "];
    const oldMouseWorld = { ...Client.mouseWorld };
    const oldWaypoint = Client.waypoint;
    const oldNavCommand = Client.navCommand;

    for (const frame of this.unackInputs) {
      const p = getState().player;
      if (!p) continue;
      this.applyInputLocally(frame);
      this.replayPredictedActions(frame, p);
      tickAbilities(TICK_DT, p);
      updateShip(TICK_DT, p);
      updateTutorialTrack(TICK_DT, p, true);
      updateCombat(TICK_DT, p, { lockPredictionOnly: true });
    }

    // Restore current local input state
    Client.keys[" "] = oldSpace;
    Client.mouseWorld.x = oldMouseWorld.x;
    Client.mouseWorld.y = oldMouseWorld.y;

    // Smart restoration: only restore waypoint/navCommand if the client has updated them
    // since the last replayed frame (or snapshot if no unacknowledged frames exist).
    const lastFrame = this.unackInputs[this.unackInputs.length - 1];
    const lastExpectedWaypoint = lastFrame ? lastFrame.waypoint : snap.player.waypoint;
    if (!areWaypointsEqual(oldWaypoint, lastExpectedWaypoint)) {
      Client.waypoint = oldWaypoint;
    }

    const lastExpectedNav = lastFrame ? lastFrame.navCommand : snap.player.navCommand;
    if (!areNavCommandsEqual(oldNavCommand, lastExpectedNav)) {
      Client.navCommand = oldNavCommand;
    }

    // Keep the replayed predicted state. applySnapshotToG() already rewound the
    // player to the authoritative server tick before this method ran; moving
    // back toward that server-tick position after replay causes visible rubber
    // banding while flying.
    this.errorX = 0;
    this.errorY = 0;
  }

  public clear() {
    this.unackInputs = [];
    this.lastServerTick = -1;
    this.errorX = 0;
    this.errorY = 0;
  }

  private predictFrame(frame: InputFrame) {
    const oldSpace = Client.keys[" "];
    const oldMouseWorld = { ...Client.mouseWorld };

    const p = getState().player;
    if (!p) return;

    this.applyInputLocally(frame);
    this.replayPredictedActions(frame, p);
    tickAbilities(TICK_DT, p);
    updateShip(TICK_DT, p);
    updateTutorialTrack(TICK_DT, p, false);
    updateCombat(TICK_DT, p, { lockPredictionOnly: true });

    // Restore Client inputs (but not waypoint/navCommand so local physics changes are preserved)
    Client.keys[" "] = oldSpace;
    Client.mouseWorld.x = oldMouseWorld.x;
    Client.mouseWorld.y = oldMouseWorld.y;

    // Smoothly decay reconciliation error over frames (e.g. 0.75 per frame)
    if (this.errorX !== 0 || this.errorY !== 0) {
      const prevErrX = this.errorX;
      const prevErrY = this.errorY;

      this.errorX *= 0.75;
      this.errorY *= 0.75;

      if (Math.hypot(this.errorX, this.errorY) < 0.05) {
        this.errorX = 0;
        this.errorY = 0;
      }

      const dx = this.errorX - prevErrX;
      const dy = this.errorY - prevErrY;

      PlayerAccess.updatePhysics({
        x: p.x + dx,
        y: p.y + dy,
        px: p.px + dx,
        py: p.py + dy,
      }, p);
    }
  }

  private applyInputLocally(frame: InputFrame) {
    Client.keys[" "] = frame.keys.space;
    Client.mouseWorld.x = frame.mouseWorld.x;
    Client.mouseWorld.y = frame.mouseWorld.y;
    Client.waypoint = frame.waypoint;
    Client.navCommand = frame.navCommand;
    if (getState().player) applyInputFrameToPlayer(frame, getState().player);
  }

  private replayPredictedActions(frame: InputFrame, p: Player) {
    for (const action of frame.actions) {
      switch (action.type) {
        case "setFireControlSlot":
          PlayerAccess.setFireControlSlot(action.payload.slot, p);
          break;
        case "toggleSlotDefaultAction":
          replayPredictedToggleSlotAction(action.payload.rack, action.payload.idx, p);
          break;
        case "assignModuleSlotToTarget":
          assignModuleSlotToTarget(
            action.payload.slotIdx,
            action.payload.targetId,
            p,
            { ...action.payload.opts, silent: true, suppressFrameAction: true },
          );
          break;
        case "requestSensorLock":
          {
            const existing = p.lockQueue.find((slot) => slot.id === action.payload.id);
            // Prediction replay should not flip an already-selected assignment off.
            if (existing && !existing.resolving && p._assignTargetId === action.payload.id) break;
            requestSensorLock(action.payload.id, p, { suppressFrameAction: true });
          }
          break;
        case "removeSensorLock":
          removeSensorLock(action.payload.id, p, { suppressFrameAction: true });
          break;
        case "selectLockTarget":
          // Idempotent replay: keep selection on, avoid toggle-off behavior.
          if (p._assignTargetId === action.payload.id) break;
          selectLockTarget(action.payload.id, p, { suppressFrameAction: true });
          break;
        case "clearSensorLocks":
          clearSensorLocks(p, { suppressFrameAction: true });
          break;
        case "setTractorTightness":
          PlayerAccess.setTractorTightness(action.payload.value, p);
          break;
        case "setMapScannerPower":
          PlayerAccess.setMapScannerActive(action.payload.active, p);
          break;
        case "setMapScannerCone":
          PlayerAccess.setScannerConeDeg(action.payload.coneDeg, p);
          break;
        case "setMapScannerStrength":
          PlayerAccess.setMapScannerStrength(action.payload.strength, p);
          break;
        case "startScanPulse":
          startScanPulse(p, {
            angleDeg: action.payload.angleDeg,
            allowWithoutMapOpen: true,
            silent: true,
          });
          break;
        case "setHighTarget":
          PlayerAccess.setHighTarget(action.payload.idx, action.payload.targetId, p);
          break;
      }
    }
  }
}

function areWaypointsEqual(a: { x: number; y: number } | null | undefined, b: { x: number; y: number } | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

type NavCommand = { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;

function areNavCommandsEqual(a: NavCommand, b: NavCommand): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.mode === b.mode && a.targetId === b.targetId && a.rangePx === b.rangePx && a.dir === b.dir;
}

export const predictionManager = new PredictionManager();
