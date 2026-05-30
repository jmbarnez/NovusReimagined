import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { buildEnemyFromSpawn } from "../src/utils/spawn.js";
import { pickHostileTarget, processNpcBehavior, isPlayerRef } from "../src/physics/npc-ai.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import type { Enemy } from "../src/types/world.js";

function makeHostileNearPlayer(dist = 150): Enemy {
  const sys = G.GALAXY[0]!;
  const zone = { x: G.P.x + dist, y: G.P.y, radius: 50, enemies: [{ type: "rat", count: 1, level: 1 }] };
  return buildEnemyFromSpawn(sys, zone, zone.enemies[0], 0, () => 0.5);
}

describe("pickHostileTarget", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.x = 0;
    G.P.y = 0;
    G.P.hp = 100;
  });

  it("acquires the player within aggro range", () => {
    const e = makeHostileNearPlayer(150);
    e.aggroRange = 310;
    const target = pickHostileTarget(e, e.aggroRange);
    expect(target).toBe(G.P);
  });

  it("ignores the player beyond aggro range", () => {
    const e = makeHostileNearPlayer(500);
    e.aggroRange = 310;
    const target = pickHostileTarget(e, e.aggroRange);
    expect(target).toBeNull();
  });
});

describe("processNpcBehavior", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.x = 0;
    G.P.y = 0;
    G.P.hp = 100;
  });

  it("marks a nearby hostile enemy as targeting the player", () => {
    const e = makeHostileNearPlayer(150);
    e.aggroRange = 310;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e.targetingPlayer).toBe(true);
    expect(e._npcTarget).toBe(G.P);
  });

  it("does not target the player when faction is neutral (until provoked)", () => {
    const e = makeHostileNearPlayer(150);
    e.faction = "neutral";
    e.aggroRange = 310;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e.targetingPlayer).toBeFalsy();
  });

  it("sets explicit hostile faction on spawned enemies", () => {
    const e = makeHostileNearPlayer(150);
    expect(e.faction).toBe("hostile");
  });

  it("resolves stale player refs after initPlayer()", () => {
    const e = makeHostileNearPlayer(150);
    e.aggroRange = 310;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    const stalePlayer = e._npcTarget;
    expect(stalePlayer).toBe(G.P);

    const replacement = makePlayer();
    replacement.x = G.P.x;
    replacement.y = G.P.y;
    replacement.hp = 100;
    installTestPlayer(replacement);

    expect(isPlayerRef(stalePlayer)).toBe(true);
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e._npcTarget).toBe(G.P);
    expect(e.targetingPlayer).toBe(true);
  });

  it("keeps targeting when hull is breached but structure remains", () => {
    const e = makeHostileNearPlayer(150);
    e.aggroRange = 310;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e.targetingPlayer).toBe(true);

    G.P.hp = 0;
    G.P.structure = 50;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e.targetingPlayer).toBe(true);
    expect(e._npcTarget).toBe(G.P);
  });

  it("drops targeting only when structure is destroyed", () => {
    const e = makeHostileNearPlayer(150);
    e.aggroRange = 310;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);

    G.P.hp = 0;
    G.P.structure = 0;
    processNpcBehavior(e, 0.1, 150, e.aggroRange);
    expect(e.targetingPlayer).toBeFalsy();
    expect(e._npcTarget).toBeNull();
  });

  it("retaliates when provoked even with neutral faction (via pickHostileTarget)", () => {
    const e = makeHostileNearPlayer(150);
    e.faction = "neutral";
    e.aggroRange = 310;
    e._lastPlayerHitAt = performance.now();
    const target = pickHostileTarget(e, e.aggroRange);
    expect(target).toBe(G.P);
  });
});
