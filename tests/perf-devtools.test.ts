import { afterEach, describe, expect, it, vi } from "vitest";
import { createPerfCaptureReport, installPerfDevtools } from "../src/render/perf-devtools.js";
import { recordRenderTimings, resetPerfTimingTelemetry } from "../src/render/perf-telemetry.js";

describe("perf devtools", () => {
  afterEach(() => {
    resetPerfTimingTelemetry();
    delete window.novusPerf;
    vi.restoreAllMocks();
  });

  it("creates a sorted top-section capture report from render timings", () => {
    resetPerfTimingTelemetry();
    recordRenderTimings([
      { label: "start", atMs: 0 },
      { label: "entities", atMs: 1.5 },
      { label: "hud", atMs: 2 },
      { label: "end", atMs: 2.25 },
    ]);
    recordRenderTimings([
      { label: "start", atMs: 10 },
      { label: "entities", atMs: 13 },
      { label: "hud", atMs: 13.25 },
      { label: "end", atMs: 13.5 },
    ]);

    const report = createPerfCaptureReport({ top: 2 });

    expect(report.samples).toBe(2);
    expect(report.topSections).toHaveLength(2);
    expect(report.topSections[0]?.id).toBe("entities");
    expect(report.topSections[0]?.section).toBe("Entities");
    expect(report.topSections[0]?.p95Ms).toBe(3);
  });

  it("installs console-callable helpers on window", () => {
    const tableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => undefined);
    vi.spyOn(console, "groupEnd").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    installPerfDevtools();

    expect(window.novusPerf).toBeDefined();
    expect(window.novusPerf?.snapshot()).toHaveProperty("timings");
    expect(window.novusPerf?.report({ top: 1 })).toHaveProperty("topSections");
    window.novusPerf?.reset();
    expect(tableSpy).toHaveBeenCalled();
  });
});
