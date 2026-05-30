import { Client, type Player } from "../state.js";
import { isHeadlessServer } from "../physics/net-input.js";
import { simulationTick } from "../physics.js";
import { setActiveRng, mkRng } from "../utils/math.js";
import type { InputFrame } from "./input.js";
import { isLocalPlayer } from "../player-registry.js";
import { executeGameCommand } from "./commands.js";

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
    p.inputKeys = { space: frame.keys.space };
    p.inputMouseWorld = { x: frame.mouseWorld.x, y: frame.mouseWorld.y };
    p.waypoint = frame.waypoint;
    p.navCommand = frame.navCommand;

    if (!isHeadlessServer() && isLocalPlayer(p)) {
      Client.keys[" "] = frame.keys.space;
      Client.mouseWorld.x = frame.mouseWorld.x;
      Client.mouseWorld.y = frame.mouseWorld.y;
      Client.waypoint = frame.waypoint;
      Client.navCommand = frame.navCommand;
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
