import { Client, type Player } from "../state.js";
import { isHeadlessServer } from "../physics/net-input.js";
import { simulationTick } from "../physics.js";
import { setActiveRng, mkRng } from "../utils/math.js";
import type { InputFrame } from "./input.js";
import { isLocalPlayer } from "../player-registry.js";
import { executeGameCommand } from "./commands.js";
import { setPlayerInput } from "../player/input-state.js";

export class Simulation {
  public simTick = 0;
  private rngSeed: string;
  private currentRng: () => number;

  constructor(seed: string = "novus-default-seed") {
    this.rngSeed = seed;
    this.currentRng = mkRng(seed);
  }

  public init() {
    setActiveRng(this.currentRng);
  }

  public shutdown() {
    setActiveRng(null);
  }

  /** Apply a full input frame (continuous state + discrete actions). Used for net replay / remote prediction. */
  public applyInput(frame: InputFrame, p: Player) {
    if (!p) return;
    p.netInputFrame = frame;
    setPlayerInput(p.netId ?? p.shipId, {
      space: frame.keys.space,
      w: frame.keys.w,
      a: frame.keys.a,
      s: frame.keys.s,
      d: frame.keys.d,
      boost: frame.keys.boost,
      warp: frame.keys.warp,
    }, { x: frame.mouseWorld.x, y: frame.mouseWorld.y });
    p.movementControlMode = frame.movementControlMode;
    p.waypoint = frame.waypoint;
    p.navCommand = frame.navCommand;

    if (!isHeadlessServer() && isLocalPlayer(p)) {
      Client.keys[" "] = frame.keys.space;
      Client.keys["w"] = frame.keys.w;
      Client.keys["a"] = frame.keys.a;
      Client.keys["s"] = frame.keys.s;
      Client.keys["d"] = frame.keys.d;
      Client.keys["boost"] = frame.keys.boost;
      Client.keys["warp"] = frame.keys.warp;
      Client.mouseWorld.x = frame.mouseWorld.x;
      Client.mouseWorld.y = frame.mouseWorld.y;
      Client.waypoint = frame.waypoint;
      Client.navCommand = frame.navCommand;
      Client.settings.movementControlMode = frame.movementControlMode;
    }

    this.applyActions(frame, p);
  }

  /** Process only discrete actions (fire, warp, etc.) without Client input binding. */
  public applyActions(frame: InputFrame, p: Player) {
    if (!p) return;
    for (const command of frame.actions) {
      try {
        executeGameCommand(command, p);
      } catch (err) {
        console.warn("[Simulation] Ignored invalid input command:", err);
      }
    }
  }

  /** Authoritative simulation step (server worker). */
  public tick(dt: number) {
    simulationTick(dt);
    this.simTick++;
  }
}
