import { afterEach, describe, expect, it } from "vitest";
import {
  getPerfTimingSnapshot,
  recordRenderTimings,
  resetPerfTimingTelemetry,
  summarizeSamples,
} from "../src/render/perf-telemetry.js";

describe("perf telemetry", () => {
  afterEach(() => {
    resetPerfTimingTelemetry();
  });

  it("summarizes rolling samples with nearest-rank percentiles", () => {
    const stats = summarizeSamples("render", [1, 2, 3, 4, 20]);

    expect(stats.latestMs).toBe(20);
    expect(stats.avgMs).toBe(6);
    expect(stats.p50Ms).toBe(3);
    expect(stats.p95Ms).toBe(20);
    expect(stats.maxMs).toBe(20);
    expect(stats.samples).toBe(5);
  });

  it("records total and section timings from ordered marks", () => {
    recordRenderTimings([
      { label: "start", atMs: 10 },
      { label: "bg", atMs: 11.5 },
      { label: "entities", atMs: 14 },
      { label: "renderPixi", atMs: 16 },
      { label: "end", atMs: 17 },
    ]);

    const snapshot = getPerfTimingSnapshot();
    const byId = new Map(snapshot.sections.map((section) => [section.id, section]));

    expect(snapshot.frames).toBe(1);
    expect(snapshot.total.latestMs).toBe(7);
    expect(byId.get("bg")?.latestMs).toBe(1.5);
    expect(byId.get("entities")?.latestMs).toBe(2.5);
    expect(byId.get("renderPixi")?.latestMs).toBe(2);
    expect(byId.get("end")?.latestMs).toBe(1);
  });

  it("caps the timing window to the newest 180 frames", () => {
    for (let i = 0; i < 181; i++) {
      recordRenderTimings([
        { label: "start", atMs: 0 },
        { label: "renderPixi", atMs: i },
      ]);
    }

    const snapshot = getPerfTimingSnapshot();

    expect(snapshot.frames).toBe(180);
    expect(snapshot.total.latestMs).toBe(180);
    expect(snapshot.total.maxMs).toBe(180);
    expect(snapshot.total.p50Ms).toBe(90);
  });
});
