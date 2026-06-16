import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_TRACKS,
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
import { updateTutorialTrack } from "../src/physics/tutorial-track.js";

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

  it("spawn sits on approach lane outside the belt", () => {
    expect(TUTORIAL_SPAWN.x).toBeGreaterThan(2000);
    const sun = getTutorialSunWorldPos();
    expect(sun.x).toBe(0);
    expect(Math.hypot(TUTORIAL_SPAWN.x - sun.x, TUTORIAL_SPAWN.y - sun.y)).toBeGreaterThan(600);
    expect(shouldRelocateTutorialStart(TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y)).toBe(false);
    expect(shouldRelocateTutorialStart(0, 0)).toBe(true);
    expect(shouldRelocateTutorialStart(sun.x + 500, sun.y)).toBe(true);
    expect(shouldRelocateTutorialStart(sun.x + 200, sun.y)).toBe(true);
    const approach = getTutorialTrackById("approach")!;
    const prox = distToTrack(approach, TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y);
    expect(prox.inside).toBe(true);
    expect(prox.arcLength).toBeLessThan(50);
  });

  it("arc length progress increases toward track end", () => {
    const approach = getTutorialTrackById("approach")!;
    const start = trackArcLengthProgress(approach, TUTORIAL_SPAWN.x, TUTORIAL_SPAWN.y);
    const station = approach.points[approach.points.length - 1];
    const end = trackArcLengthProgress(approach, station.x, station.y);
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
});

describe("gate boost particles", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    Client.stationOpen = false;
    G.pendingEffects = [];
  });

  it("no longer queues effects after boost gates were removed", () => {
    G.P.sysIdx = 0;
    G.P.x = 0;
    G.P.y = 0;
    G.P.vx = 100;
    G.P.vy = 0;
    updateTutorialTrack(0.016, G.P);
    const effects = G.pendingEffects.filter((e) => e.type === "gateBoostParticles");
    expect(effects).toHaveLength(0);
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
