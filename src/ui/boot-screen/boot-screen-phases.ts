import { t } from "../../utils/i18n.js";
import { appendLogEntry, flushPendingLogEntries, registerLogSink } from "../hud/logs.js";

/**
 * Boot Screen Phase Controller
 *
 * Owns the loading->title monitor transitions and boot progress updates.
 * Keep this file focused on phase/state mutations only.
 */

/** Register the right-monitor loading console as a system log sink. */
export function registerLoadingConsole(): void {
  const consoleEl = document.querySelector(".ld-console") as HTMLElement | null;
  if (!consoleEl) return;
  registerLogSink(consoleEl);
  flushPendingLogEntries();
}

/** Fade the full loading overlay out when entering space mode. */
export function dismissLoadingScreen(): void {
  const loadingEl = document.getElementById("loading");
  if (!loadingEl) return;
  loadingEl.style.opacity = "";
  loadingEl.classList.add("out");
  loadingEl.style.pointerEvents = "none";
}

/** Switch monitor presentation from loading phase to title/menu phase. */
export function transitionToTitleScreen(): void {
  const loadingEl = document.getElementById("loading");
  if (!loadingEl) return;
  loadingEl.classList.add("ld-title-mode");
}

const telemetryByPhase: Record<string, { subsystem: string; progress: string; status: string }> = {
  start: { subsystem: t("boot.kernel"), progress: "12%", status: t("boot.init") },
  ui:    { subsystem: t("boot.hudRenderer"), progress: "38%", status: t("boot.load") },
  world: { subsystem: t("boot.galaxyGen"), progress: "62%", status: t("boot.build") },
  pixi:  { subsystem: t("boot.pixelPipe"), progress: "91%", status: t("boot.link") },
};

function updateTelemetry(phase: string): void {
  const data = telemetryByPhase[phase];
  if (!data) return;
  const subsystem = document.getElementById("boot-telemetry-subsystem");
  const progress  = document.getElementById("boot-telemetry-progress");
  const memory    = document.getElementById("boot-telemetry-memory");
  const status    = document.getElementById("boot-telemetry-status");
  if (subsystem) subsystem.textContent = data.subsystem;
  if (progress)  progress.textContent  = data.progress;
  if (status)    status.textContent    = data.status;
  if (memory) {
    const mem = (performance as unknown as Record<string, unknown>).memory as { usedJSHeapSize?: number } | undefined;
    memory.textContent = mem ? `${(mem.usedJSHeapSize! / 1048576).toFixed(1)} MB` : t("common.dash");
  }
}

/**
 * Mark boot milestones for diagnostics and update visual progress UI.
 * Centralized here so all boot phase side effects are searchable in one place.
 */
export function markBootPhase(name: string): void {
  try {
    performance.mark(`novus:boot:${name}`);

    const linesByPhase: Record<string, string[]> = {
      start: [t("loading.init"), t("loading.network"), t("loading.neural")],
      ui: [t("loading.hud"), t("loading.hudMapping"), t("loading.hudLoaded")],
      world: [t("loading.worldGen"), t("loading.worldPop"), t("loading.worldGrid")],
      pixi: [t("loading.pixi"), t("loading.pixiTextures"), t("loading.pixiShaders")],
    };

    for (const line of linesByPhase[name] ?? []) {
      appendLogEntry(line.replace(/^>\s*/, ""), "system");
    }

    const progressFill = document.querySelector(".ld-progress-fill") as HTMLElement | null;
    if (progressFill) {
      const widthByPhase: Record<string, string> = {
        start: "15%",
        ui: "45%",
        world: "75%",
        pixi: "100%",
      };
      progressFill.style.width = widthByPhase[name] ?? progressFill.style.width;
    }

    const subEl = document.getElementById("ld-sub");
    if (subEl) {
      const subByPhase: Record<string, string> = {
        start: t("loading.init"),
        ui:    t("loading.hud"),
        world: t("loading.worldGen"),
        pixi:  t("loading.pixi"),
      };
      const text = subByPhase[name] ?? subEl.textContent ?? "";
      subEl.textContent = text.replace(/^>\s*/, "");
    }

    updateTelemetry(name);
  } catch {
    // Ignore if performance API / DOM is unavailable.
  }
}

/** Log local development boot timing. */
export function logBootTiming(): void {
  const isLocalDev =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.port === "5173";
  if (!isLocalDev) return;

  try {
    performance.mark("novus:boot:title-ready");
    const htmlStart = performance.getEntriesByName("novus:html-parsed", "mark")[0];
    const bootStart = performance.getEntriesByName("novus:boot:start", "mark")[0];
    const titleReady = performance.getEntriesByName("novus:boot:title-ready", "mark")[0];

    if (htmlStart && titleReady) {
      const totalMs = titleReady.startTime - htmlStart.startTime;
      const bootMs = bootStart ? titleReady.startTime - bootStart.startTime : totalMs;
      console.info(`[novus boot] html→title: ${totalMs.toFixed(0)}ms | boot(): ${bootMs.toFixed(0)}ms`);
    }

    performance.measure("novus:boot:total", "novus:html-parsed", "novus:boot:title-ready");
  } catch {
    // Ignore measurement failures.
  }
}
