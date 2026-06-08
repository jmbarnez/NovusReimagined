import type { Player } from "../state.js";
import type { GameCommand } from "../sim/commands.js";
import type { InputFrame } from "../sim/input.js";

export interface ConsumedInput {
  frame: InputFrame | null;
  /** Actions from frames the server already passed (tick lag) — must still be applied once. */
  staleActions: GameCommand[];
}

export class ClientSession {
  public id: string;
  public name: string;
  public playerState: Player;
  public lastAckedTick = -1;
  public inputBuffer: InputFrame[] = [];
  public connectionTime: number;
  private lastInputTick = -1;
  private lastContinuousFrame: InputFrame | null = null;

  constructor(id: string, name: string, initialState: Player) {
    this.id = id;
    this.name = name;
    this.playerState = initialState;
    this.connectionTime = Date.now();
  }

  public addInput(frame: InputFrame) {
    if (this.lastInputTick !== -1) {
      const gap = frame.tick - this.lastInputTick;
      if (gap > 10) {
        console.warn(`[ClientSession] Significant input gap detected for ${this.name} (${this.id}): gap of ${gap} ticks (last: ${this.lastInputTick}, current: ${frame.tick})`);
      }
    }
    this.lastInputTick = frame.tick;
    this.lastContinuousFrame = frame;

    // Keep inputs sorted by tick using insertion (O(1) in the common case)
    let insertIdx = this.inputBuffer.length;
    while (insertIdx > 0 && this.inputBuffer[insertIdx - 1].tick > frame.tick) {
      insertIdx--;
    }
    this.inputBuffer.splice(insertIdx, 0, frame);
    
    // Cap buffer size to prevent memory leaks from lagging clients
    if (this.inputBuffer.length > 120) {
      this.inputBuffer.shift();
    }
  }

  public consumeInputForTick(currentTick: number): ConsumedInput {
    const staleActions: GameCommand[] = [];
    let latestLaggedFrame: InputFrame | null = null;
    if (this.inputBuffer.length === 0) {
      if (this.lastContinuousFrame) {
        return { frame: { ...this.lastContinuousFrame, tick: currentTick, actions: [] }, staleActions };
      }
      return { frame: null, staleActions };
    }

    // Frames behind server time are not replayed for movement, but discrete actions must run.
    while (this.inputBuffer.length > 0 && this.inputBuffer[0].tick < currentTick) {
      const dropped = this.inputBuffer.shift()!;
      latestLaggedFrame = dropped;
      this.lastContinuousFrame = dropped;
      if (dropped.actions.length > 0) {
        staleActions.push(...dropped.actions);
      }
    }
    if (this.inputBuffer.length === 0) {
      // Preserve latest continuous input state (keys/mouse/nav/waypoint) even when
      // every frame arrived late this tick. Actions were already drained above.
      if (latestLaggedFrame) {
        return { frame: { ...latestLaggedFrame, actions: [] }, staleActions };
      }
      if (this.lastContinuousFrame) {
        return { frame: { ...this.lastContinuousFrame, tick: currentTick, actions: [] }, staleActions };
      }
      return { frame: null, staleActions };
    }

    const exactIdx = this.inputBuffer.findIndex((f) => f.tick === currentTick);
    if (exactIdx !== -1) {
      const frame = this.inputBuffer[exactIdx];
      this.inputBuffer.splice(exactIdx, 1);
      this.lastContinuousFrame = frame;
      return { frame, staleActions };
    }

    // Client tick can lead/lag slightly — consume the oldest pending frame once
    const next = this.inputBuffer[0];
    if (next.tick <= currentTick + 8) {
      this.inputBuffer.shift();
      this.lastContinuousFrame = next;
      return { frame: next, staleActions };
    }

    // If queued input is too far in the future, still keep last known continuous state.
    if (latestLaggedFrame) {
      return { frame: { ...latestLaggedFrame, actions: [] }, staleActions };
    }

    if (this.lastContinuousFrame) {
      return { frame: { ...this.lastContinuousFrame, tick: currentTick, actions: [] }, staleActions };
    }
    return { frame: null, staleActions };
  }
}
