import { getState } from "../state-access.js";
import { Client, _G, type Player } from "../state.js";
import { Simulation } from "../sim/index.js";
import { ClientSession } from "./client-session.js";
import { createSnapshot, diffSnapshots, type WorldSnapshot } from "../sim/snapshot.js";
import { PlayerAccess, WorldAccess } from "../state-access.js";
import { sanitizeInputFrame, type InputFrame } from "../sim/input.js";
import { bindPlayerNetInput } from "../physics/net-input.js";
import { buildGalaxy, populateSystem } from "../world-gen.js";
import { resolvePlayerSpawn, needsSpawnResolution } from "../utils/player-spawn.js";
import { SpatialGrid } from "../utils/spatial.js";
import { C } from "../config/index.js";
import { createDurableCharacterSync, createServerPlayerState } from "./player-sanitize.js";
import { MAX_CATCH, TICK_DT } from "../constants.js";

// GameServer class: Coordinates the headless physics simulation (60Hz) 
// and player connections, state diffing, and broadcasts (20Hz).
export class GameServer {
  private sim: Simulation;
  private sessions = new Map<string, ClientSession>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private currentTick = 0;
  private isRunning = false;
  private tickAccumulator = 0;
  private lastTickMs = 0;
  private sendCallback: (clientId: string, msg: unknown) => void;

  // Track each client's last sent snapshot for delta compression
  private lastSnapshots = new Map<string, WorldSnapshot>();

  constructor(sendCallback: (clientId: string, msg: unknown) => void) {
    this.sendCallback = sendCallback;
    this.sim = new Simulation("novus-server-seed");
  }

  public get ready(): boolean {
    return this.isRunning;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    (globalThis as { IS_SERVER?: boolean }).IS_SERVER = true;

    WorldAccess.setGalaxy(buildGalaxy());
    for (const sys of getState().GALAXY) {
      populateSystem(sys);
    }

    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));

    this.sim.init();

    this.tickAccumulator = 0;
    this.lastTickMs = performance.now();
    this.tickInterval = setInterval(() => {
      this.pumpTicks();
    }, 1000 / 60);

    console.log("[GameServer] Headless server running at 60Hz and simulating all systems");
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.sim.shutdown();
    PlayerAccess.clearServerPlayers();
    console.log("[GameServer] Headless server stopped");
  }

  public handleClientConnect(id: string, name: string, characterData: Player) {
    if (!this.isRunning) {
      console.warn(`[GameServer] Rejecting connect for ${name}: server not ready`);
      return;
    }

    console.log(`[GameServer] Player connected: ${name} (${id})`);
    const isPrimarySession = this.sessions.size === 0;

    const playerState = createServerPlayerState(id, name, characterData, getState().GALAXY);

    if (needsSpawnResolution(playerState)) {
      resolvePlayerSpawn(playerState, getState().GALAXY);
      console.log(
        `[GameServer] Resolved spawn for ${name} at (${playerState.x.toFixed(1)}, ${playerState.y.toFixed(1)})`
      );
    }

    const session = new ClientSession(id, name, playerState);
    this.sessions.set(id, session);

    if (isPrimarySession) {
      PlayerAccess.installServerPrimaryPlayer(playerState);
    } else {
      PlayerAccess.addServerPlayer(playerState);
    }

    const others = Array.from(this.sessions.entries())
      .filter(([sid]) => sid !== id)
      .map(([, s]) => ({
        netId: s.id,
        pilotName: s.name,
        shipId: s.playerState.shipId,
        x: s.playerState.x,
        y: s.playerState.y,
        sysIdx: s.playerState.sysIdx,
      }));

    this.sendCallback(id, {
      type: "connect_ack",
      payload: {
        success: true,
          clientId: id,
          tick: this.currentTick,
          spawn: {
          x: playerState.x,
          y: playerState.y,
          px: playerState.px,
          py: playerState.py,
          sysIdx: playerState.sysIdx,
        },
        others,
      },
    });

    this.broadcastToOthers(id, {
      type: "player_joined",
      payload: {
        id,
        netId: id,
        name,
        shipId: playerState.shipId,
        x: playerState.x,
        y: playerState.y,
        sysIdx: playerState.sysIdx,
      },
    });

    this.lastSnapshots.clear();
    this.broadcastSnapshots();
  }

  public handleClientDisconnect(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;

    console.log(`[GameServer] Player disconnected: ${session.name} (${id})`);

    this.sendCallback(id, {
      type: "sync_character",
      payload: {
        character: createDurableCharacterSync(session.playerState),
      },
    });

    this.sessions.delete(id);
    this.lastSnapshots.delete(id);
    PlayerAccess.removeServerPlayer(session.playerState.netId ?? id);

    this.broadcast({
      type: "player_left",
      payload: {
        id,
        name: session.name,
      },
    });
  }

  public handleClientInput(id: string, frame: InputFrame) {
    const session = this.sessions.get(id);
    if (!session) return;
    const sanitized = sanitizeInputFrame(frame);
    if (!sanitized) return;
    session.addInput(sanitized);
  }

  public handleClientAck(id: string, tick: number) {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAckedTick = tick;
    }
  }

  private pumpTicks() {
    const now = performance.now();
    const elapsed = Math.min((now - this.lastTickMs) / 1000, 0.25);
    this.lastTickMs = now;
    this.tickAccumulator += elapsed;

    let ran = 0;
    while (this.tickAccumulator >= TICK_DT && ran < MAX_CATCH) {
      this.tick(TICK_DT);
      this.tickAccumulator -= TICK_DT;
      ran++;
    }

    if (this.tickAccumulator > MAX_CATCH * TICK_DT) {
      this.tickAccumulator = MAX_CATCH * TICK_DT;
    }
  }

  private tick(dt: number) {
    this.currentTick++;

    for (const session of this.sessions.values()) {
      const { frame, staleActions } = session.consumeInputForTick(this.currentTick);
      session.playerState.netInputFrame = frame ?? null;
      bindPlayerNetInput(session.playerState, frame);
      if (session.playerState === getState().player) {
        Client.keys[" "] = !!session.playerState.inputKeys?.space;
        Client.mouseWorld.x = session.playerState.inputMouseWorld?.x ?? session.playerState.x + Math.cos(session.playerState.angle) * 200;
        Client.mouseWorld.y = session.playerState.inputMouseWorld?.y ?? session.playerState.y + Math.sin(session.playerState.angle) * 200;
        Client.waypoint = session.playerState.waypoint ?? null;
        Client.navCommand = session.playerState.navCommand ?? null;
      }
      if (staleActions.length > 0) {
        this.sim.applyActions(
          { tick: this.currentTick, keys: { space: false }, mouseWorld: { x: 0, y: 0 }, waypoint: null, navCommand: null, actions: staleActions },
          session.playerState,
        );
      }
      if (frame && frame.actions.length > 0) {
        this.sim.applyActions(frame, session.playerState);
      }
    }

    this.sim.tick(dt);

    for (const session of this.sessions.values()) {
      session.playerState.netInputFrame = null;
    }

    const effects = getState().pendingEffects;
    if (effects && effects.length > 0) {
      this.broadcast({
        type: "effects",
        payload: {
          effects: effects
        }
      });
      getState().pendingEffects.length = 0;
    }

    if (this.currentTick % 3 === 0) {
      this.broadcastSnapshots();
    }
  }

  private broadcastSnapshots() {
    for (const session of this.sessions.values()) {
      const newSnap = createSnapshot(this.currentTick, _G, session.playerState);
      const lastSnap = this.lastSnapshots.get(session.id);

      let payload: ReturnType<typeof diffSnapshots> | {
        tick: number;
        fromTick: number;
        player: WorldSnapshot["player"];
        entities: { spawned: WorldSnapshot["entities"] };
      };
      if (lastSnap) {
        payload = diffSnapshots(lastSnap, newSnap);
      } else {
        payload = {
          tick: newSnap.tick,
          fromTick: -1,
          player: newSnap.player,
          entities: { spawned: newSnap.entities },
        };
      }

      this.lastSnapshots.set(session.id, newSnap);

      this.sendCallback(session.id, {
        type: "snapshot",
        payload,
      });
    }
  }

  public handleClientChat(id: string, message: string) {
    const session = this.sessions.get(id);
    const senderName = session ? session.name : "Unknown";
    console.log(`[GameServer] Chat from ${senderName}: ${message}`);
    this.broadcast({
      type: "chat",
      payload: {
        senderName,
        senderId: id,
        message,
      }
    });
  }

  public handleClientTyping(id: string, typing: boolean) {
    this.broadcastToOthers(id, {
      type: "typing",
      payload: { id, typing },
    });
  }

  private broadcast(msg: unknown) {
    for (const id of this.sessions.keys()) {
      this.sendCallback(id, msg);
    }
  }

  private broadcastToOthers(excludeId: string, msg: unknown) {
    for (const id of this.sessions.keys()) {
      if (id !== excludeId) {
        this.sendCallback(id, msg);
      }
    }
  }
}
