import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_TRACKS,
  TUTORIAL_BOOST_GATES,
  TUTORIAL_SPAWN,
  trackTotalArcLength,
  trackArcLengthProgress,
  distToTrack,
  getTutorialTrackById,
  getActiveTutorialTracks,
  getTutorialSunWorldPos,
  shouldRelocateTutorialStart,
} from "../src/data/tutorial-layout.js";
import { canModifyFitting } from "../src/utils/fitting-gate.js";
import { detectGateCrossing, getBoostGatesForTrack } from "../src/data/tutorial-layout.js";

describe("tutorial tracks", () => {
  it("defines approach, return spoke, and three hub spokes", () => {
    expect(TUTORIAL_TRACKS.map((t) => t.id)).toEqual([
      "approach",
      "spoke-mining",
      "spoke-mining-return",
      "spoke-gunnery",
      "spoke-gate",
    ]);
  });

  it("spawn sits on approach lane opposite the sun", () => {
    expect(TUTORIAL_SPAWN.x).toBeLessThan(-1800);
    expect(TUTORIAL_SPAWN.x).toBeGreaterThan(-2800);
    const sun = getTutorialSunWorldPos();
    expect(sun.x).toBeLessThan(TUTORIAL_SPAWN.x);
    expect(Math.hypot(TUTORIAL_SPAWN.x - sun.x, TUTORIAL_SPAWN.y - sun.y)).toBeGreaterThan(600);
    expect(shouldRelocateTutorialStart(TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y)).toBe(false);
    expect(shouldRelocateTutorialStart(0, 0)).toBe(true);
    expect(shouldRelocateTutorialStart(2800, 0)).toBe(true);
    expect(shouldRelocateTutorialStart(sun.x + 200, sun.y)).toBe(true);
    const approach = getTutorialTrackById("approach")!;
    const prox = distToTrack(approach, TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y);
    expect(prox.inside).toBe(true);
    expect(prox.arcLength).toBeLessThan(50);
  });

  it("arc length progress increases toward track end", () => {
    const approach = getTutorialTrackById("approach")!;
    const start = trackArcLengthProgress(approach, TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y);
    const end = trackArcLengthProgress(approach, 0, 0);
    expect(start).toBeLessThan(0.15);
    expect(end).toBeGreaterThan(0.85);
  });

  it("total arc length is positive for each track", () => {
    for (const track of TUTORIAL_TRACKS) {
      expect(trackTotalArcLength(track)).toBeGreaterThan(100);
    }
  });

  it("getActiveTutorialTracks filters by step", () => {
    expect(getActiveTutorialTracks("fly-academy").map((t) => t.id)).toEqual(["approach"]);
    expect(getActiveTutorialTracks("fly-mining").map((t) => t.id)).toEqual(["spoke-mining"]);
    expect(getActiveTutorialTracks("fly-station").map((t) => t.id)).toEqual(["spoke-mining-return"]);
    expect(getActiveTutorialTracks("industry")).toEqual([]);
    expect(getActiveTutorialTracks("fly-gunnery").map((t) => t.id)).toEqual(["spoke-gunnery"]);
  });

  it("detectGateCrossing requires passing between pillars with forward speed", () => {
    const gate = getBoostGatesForTrack("approach")[0]!;
    const nx = Math.cos(gate.angle);
    const ny = Math.sin(gate.angle);
    expect(detectGateCrossing(gate, gate.x, gate.y, gate.x - nx * 30, gate.y - ny * 30, nx * 40, ny * 40)).toBe(true);
    expect(detectGateCrossing(gate, gate.x, gate.y, gate.x - nx * 30, gate.y - ny * 30, 0, 0)).toBe(false);
    const wide = gate.halfWidth * 1.5;
    const px = Math.cos(gate.angle + Math.PI / 2);
    const py = Math.sin(gate.angle + Math.PI / 2);
    expect(detectGateCrossing(
      gate,
      gate.x + px * wide,
      gate.y + py * wide,
      gate.x + px * wide - nx * 30,
      gate.y + py * wide - ny * 30,
      nx * 40,
      ny * 40,
    )).toBe(false);
  });

  it("keeps boost gates centered and aligned on their guide tracks", () => {
    for (const gate of TUTORIAL_BOOST_GATES) {
      const track = getTutorialTrackById(gate.trackId)!;
      const prox = distToTrack(track, gate.x, gate.y);
      const angleDelta = Math.atan2(Math.sin(gate.angle - prox.tangentAngle), Math.cos(gate.angle - prox.tangentAngle));
      expect(prox.dist).toBeLessThan(1);
      expect(Math.abs(angleDelta)).toBeLessThan(0.001);
      if (gate.trackId !== "approach") {
        expect(prox.arcLength).toBeGreaterThan(300);
      }
    }
  });
});

describe("canModifyFitting", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    Client.stationOpen = false;
  });

  it("allows when docked at a station", () => {
    Client.stationOpen = true;
    expect(canModifyFitting().ok).toBe(true);
  });

  it("blocks fitting changes while in space", () => {
    G.P.vx = 0;
    G.P.vy = 0;
    expect(canModifyFitting().ok).toBe(false);
    expect(canModifyFitting().reason).toMatch(/Hangar/i);
  });

  it("blocks fitting changes while moving in space", () => {
    G.P.vx = 50;
    expect(canModifyFitting().ok).toBe(false);
  });
});
