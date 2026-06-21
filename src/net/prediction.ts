import { Client, type Player } from "../state.js";
import { getState, PlayerAccess } from "../state-access.js";
import { applyInputFrameToPlayer } from "../sim/input.js";
import { updateShip } from "../physics/ship.js";
import { updateTutorialTrack } from "../physics/tutorial-track.js";
import { tickAbilities } from "../player/abilities.js";
import { replayPredictedToggleSlotAction } from "../player/player-fitting.js";
import type { InputFrame } from "../sim/input.js";
import type { WorldSnapshot } from "../sim/snapshot.js";
import { TICK_DT } from "../constants.js";
import { updateCombat } from "../physics/combat-physics.js";
import { startScanPulse } from "../scanning/index.js";
import { detachTractorBeam } from "../player/tractor.js";

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

    for (const frame of this.unackInputs) {
      const p = getState().player;
      if (!p) continue;
      this.applyInputLocally(frame);
      this.replayPredictedActions(frame, p);
      tickAbilities(TICK_DT, p);
      updateShip(TICK_DT, p);
      updateTutorialTrack(TICK_DT, p, true);
      updateCombat(TICK_DT, p);
    }

    // Restore current local input state
    Client.keys[" "] = oldSpace;
    Client.mouseWorld.x = oldMouseWorld.x;
    Client.mouseWorld.y = oldMouseWorld.y;

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
    updateCombat(TICK_DT, p);

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
        case "retractTractorBeam":
          detachTractorBeam(p);
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
      }
    }
  }
}

export const predictionManager = new PredictionManager();
