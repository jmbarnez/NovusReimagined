import { describe, expect, it } from "vitest";
import { C } from "../src/config/index.js";
import { makePlayer } from "../src/player/player-data.js";
import {
  getEnemyNoseTurretOrigin,
  getEnemyTurretOrigin,
  getPlayerTurretOrigin,
  getShipNoseTurretOrigin,
  shipLocalToWorld,
} from "../src/combat/turret-origin.js";

describe("turret origins", () => {
  it("rotates local ship offsets into world space", () => {
    const world = shipLocalToWorld(10, 20, Math.PI / 2, 5, -3);

    expect(world.x).toBeCloseTo(13, 6);
    expect(world.y).toBeCloseTo(25, 6);
  });

  it("derives player nose mounts from ship render geometry", () => {
    const p = makePlayer();
    p.shipId = "fighter";
    p.x = 10;
    p.y = 20;
    p.angle = 0;

    expect(getShipNoseTurretOrigin(p.shipId)).toEqual({ forwardPx: 27, localDownPx: 2 });
    expect(getPlayerTurretOrigin(p)).toEqual({ x: 37, y: 22 });
  });

  it("derives enemy nose mounts from enemy render geometry", () => {
    const origin = getEnemyTurretOrigin({ x: 5, y: 7, angle: Math.PI / 2, type: "rat" });

    expect(getEnemyNoseTurretOrigin("rat")).toEqual({ forwardPx: 12, localDownPx: 2 });
    expect(origin.x).toBeCloseTo(3, 6);
    expect(origin.y).toBeCloseTo(19, 6);
  });

  it("falls back to the global turret origin for unknown hulls", () => {
    expect(getShipNoseTurretOrigin("missing-ship")).toEqual(C.COMBAT.TURRET_ORIGIN);
    expect(getEnemyNoseTurretOrigin("missing-enemy")).toEqual(C.COMBAT.TURRET_ORIGIN);
  });
});
