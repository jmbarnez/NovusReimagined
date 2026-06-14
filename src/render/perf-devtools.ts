import { t } from "../utils/i18n.js";
import { getPerformanceTelemetrySnapshot, type PerformanceTelemetrySnapshot } from "./perf-overlay.js";
import { resetPerfTimingTelemetry, type PerfSectionStats } from "./perf-telemetry.js";

export interface PerfSectionReportRow {
  section: string;
  id: string;
  nowMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
}

export interface PerfCaptureReport {
  capturedAt: string;
  fps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  totalP95Ms: number;
  samples: number;
  context: PerformanceTelemetrySnapshot["context"];
  world: PerformanceTelemetrySnapshot["world"];
  entities: PerformanceTelemetrySnapshot["entities"];
  memory: PerformanceTelemetrySnapshot["memory"];
  topSections: PerfSectionReportRow[];
}

export interface PerfReportOptions {
  top?: number;
}

export interface NovusPerfDevtools {
  snapshot(): PerformanceTelemetrySnapshot;
  report(options?: PerfReportOptions): PerfCaptureReport;
  reset(): void;
}

function timingLabel(id: string): string {
  const key = `perf.section.${id}`;
  const translated = t(key);
  return translated === key ? id : translated;
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function sectionToRow(section: PerfSectionStats): PerfSectionReportRow {
  return {
    section: timingLabel(section.id),
    id: section.id,
    nowMs: roundMs(section.latestMs),
    avgMs: roundMs(section.avgMs),
    p50Ms: roundMs(section.p50Ms),
    p95Ms: roundMs(section.p95Ms),
    maxMs: roundMs(section.maxMs),
    samples: section.samples,
  };
}

export function createPerfCaptureReport(options: PerfReportOptions = {}): PerfCaptureReport {
  const top = Math.max(1, Math.floor(options.top ?? 12));
  const snapshot = getPerformanceTelemetrySnapshot();
  return {
    capturedAt: new Date().toISOString(),
    fps: snapshot.fps,
    avgFrameMs: roundMs(snapshot.avgMs),
    maxFrameMs: roundMs(snapshot.maxMs),
    totalP95Ms: roundMs(snapshot.timings.total.p95Ms),
    samples: snapshot.timings.frames,
    context: snapshot.context,
    world: snapshot.world,
    entities: snapshot.entities,
    memory: snapshot.memory,
    topSections: snapshot.timings.sections.slice(0, top).map(sectionToRow),
  };
}

function logPerfCaptureReport(report: PerfCaptureReport): void {
  console.groupCollapsed(
    `[Novus Perf] ${report.samples} frames, total p95 ${report.totalP95Ms.toFixed(2)}ms, fps ${report.fps}`,
  );
  console.log("Context", report.context);
  console.log("World", report.world);
  console.log("Entities", report.entities);
  if (report.memory) console.log("Memory", report.memory);
  console.table(report.topSections);
  console.groupEnd();
}

export function installPerfDevtools(): void {
  if (typeof window === "undefined") return;
  window.novusPerf = {
    snapshot: getPerformanceTelemetrySnapshot,
    report: (options?: PerfReportOptions) => {
      const report = createPerfCaptureReport(options);
      logPerfCaptureReport(report);
      return report;
    },
    reset: resetPerfTimingTelemetry,
  };
}
