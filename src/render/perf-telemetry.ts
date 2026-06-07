export interface PerfTimingMark {
  label: string;
  atMs: number;
}

export interface PerfSectionStats {
  id: string;
  latestMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
}

export interface PerfTimingSnapshot {
  sampledAtMs: number;
  frameBudgetMs: number;
  frames: number;
  total: PerfSectionStats;
  sections: PerfSectionStats[];
}

interface PerfTimingSample {
  totalMs: number;
  sections: Record<string, number>;
}

export interface RecordRenderTimingOptions {
  frameBudgetMs?: number;
  logSlowFrame?: boolean;
  slowFrameThresholdMs?: number;
}

const DEFAULT_FRAME_BUDGET_MS = 1000 / 300;
const MAX_TIMING_SAMPLES = 180;

const _samples: PerfTimingSample[] = [];
let _lastSlowLogAtMs = 0;

function clampSampleWindow(): void {
  while (_samples.length > MAX_TIMING_SAMPLES) _samples.shift();
}

function percentile(sorted: readonly number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1));
  return sorted[idx] ?? 0;
}

export function summarizeSamples(id: string, values: readonly number[]): PerfSectionStats {
  if (values.length === 0) {
    return { id, latestMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, samples: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    id,
    latestMs: values[values.length - 1] ?? 0,
    avgMs: sum / values.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
    samples: values.length,
  };
}

export function resetPerfTimingTelemetry(): void {
  _samples.length = 0;
  _lastSlowLogAtMs = 0;
}

export function recordRenderTimings(
  marks: readonly PerfTimingMark[],
  options: RecordRenderTimingOptions = {},
): void {
  if (marks.length < 2) return;

  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last) return;

  const sections: Record<string, number> = {};
  for (let i = 1; i < marks.length; i++) {
    const prev = marks[i - 1];
    const mark = marks[i];
    if (!prev || !mark) continue;
    const dt = Math.max(0, mark.atMs - prev.atMs);
    sections[mark.label] = (sections[mark.label] ?? 0) + dt;
  }

  const totalMs = Math.max(0, last.atMs - first.atMs);
  _samples.push({ totalMs, sections });
  clampSampleWindow();

  const thresholdMs = options.slowFrameThresholdMs ?? options.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS;
  if (options.logSlowFrame && totalMs > thresholdMs) {
    const now = typeof performance !== "undefined" ? performance.now() : last.atMs;
    if (now - _lastSlowLogAtMs >= 1000) {
      _lastSlowLogAtMs = now;
      const parts = Object.entries(sections)
        .filter(([, value]) => value >= 0.25)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([label, value]) => `${label}:${value.toFixed(2)}ms`);
      console.log("[PERF] Slow frame", { total: `${totalMs.toFixed(2)}ms`, parts: parts.join(" | ") });
    }
  }
}

export function getPerfTimingSnapshot(frameBudgetMs = DEFAULT_FRAME_BUDGET_MS): PerfTimingSnapshot {
  const sectionIds = new Set<string>();
  for (const sample of _samples) {
    for (const id of Object.keys(sample.sections)) sectionIds.add(id);
  }

  const sections = [...sectionIds]
    .map((id) => summarizeSamples(id, _samples.map((sample) => sample.sections[id] ?? 0)))
    .sort((a, b) => b.p95Ms - a.p95Ms);

  return {
    sampledAtMs: typeof performance !== "undefined" ? performance.now() : 0,
    frameBudgetMs,
    frames: _samples.length,
    total: summarizeSamples("total", _samples.map((sample) => sample.totalMs)),
    sections,
  };
}
