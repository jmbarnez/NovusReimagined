import { t } from "../../utils/i18n.js";
import { getPerformanceTelemetrySnapshot } from "../../render/perf-overlay.js";
import { appendLogEntry, flushPendingLogEntries, registerLogSink } from "../hud/logs.js";
import { bakeExitIcon } from "../../ui/icons/exit-icon.js";
import { getElement, query, queryAll, setText as setDomText, setStyle, getStyleProperty } from "../dom-helpers.js";

/**
 * Boot Screen Phase Controller
 *
 * Owns the loading->title monitor transitions and boot progress updates.
 * Keep this file focused on phase/state mutations only.
 */

let bootPerfTimer: ReturnType<typeof setInterval> | null = null;

/** Apply i18n translations to the static boot screen HTML immediately after settings load. */
export function localizeBootScreen(): void {
  const mon1Tag   = query(".monitor-center .monitor-tag");
  const mon1Title = query(".monitor-center .monitor-title");
  const mon2Tag   = query(".monitor-right .monitor-tag");
  const mon2Title = query(".monitor-right .monitor-title");
  const consoleEl = query(".ld-console-line");
  const perfTitle = query(".boot-perf-title");
  const labels    = queryAll(".boot-perf-monitor [data-perf-label]");
  if (mon1Tag)   setDomText(mon1Tag, t("boot.monitorTagPrimary"));
  if (mon1Title) setDomText(mon1Title, t("boot.monitorTitlePrimary"));
  if (mon2Tag)   setDomText(mon2Tag, t("boot.monitorTagSecondary"));
  if (mon2Title) setDomText(mon2Title, t("boot.monitorTitleSecondary"));
  if (consoleEl) setDomText(consoleEl, t("boot.consoleInit"));
  if (perfTitle) setDomText(perfTitle, t("perf.bootTitle"));
  labels.forEach((el) => {
    const key = (el as HTMLElement).dataset.perfLabel;
    if (!key) return;
    setDomText(el as HTMLElement, t(`perf.${key}`));
  });

  const titleSp = getElement("title-sp");
  const titleMp = getElement("title-mp");
  const titleSettings = getElement("title-settings");
  const titleExit = getElement("title-exit");
  if (titleSp) setDomText(titleSp, t("title.singleplayer"));
  if (titleMp) setDomText(titleMp, t("title.multiplayer"));
  if (titleSettings) titleSettings.setAttribute("aria-label", t("title.settings"));
  if (titleExit) {
    setDomText(titleExit, "");
    titleExit.setAttribute("aria-label", t("title.safeExit"));
    setStyle(titleExit, { backgroundImage: `url(${bakeExitIcon()})`, backgroundSize: "20px", backgroundPosition: "center", backgroundRepeat: "no-repeat" });
  }

  for (const el of queryAll("[data-i18n-aria]")) {
    const key = el.dataset.i18nAria;
    if (key) el.setAttribute("aria-label", t(key));
  }

  startBootPerformanceMonitor();
}

/** Register the right-monitor loading console as a system log sink. */
export function registerLoadingConsole(): void {
  const consoleEl = query(".ld-console");
  if (!consoleEl) return;
  registerLogSink(consoleEl);
  flushPendingLogEntries();
}

/** Fade the full loading overlay out when entering space mode. */
export function dismissLoadingScreen(): void {
  const loadingEl = getElement("loading");
  if (!loadingEl) return;
  setStyle(loadingEl, { opacity: "", pointerEvents: "none" });
  loadingEl.classList.add("out");
}

/** Switch monitor presentation from loading phase to title/menu phase. */
export function transitionToTitleScreen(): void {
  const loadingEl = getElement("loading");
  if (!loadingEl) return;
  loadingEl.classList.add("ld-title-mode");
}

function setText(id: string, text: string): void {
  const el = getElement(id);
  if (el && el.textContent !== text) setDomText(el, text);
}

function updateBootPerformanceMonitor(): void {
  const loadingEl = getElement("loading");
  if (!loadingEl || loadingEl.classList.contains("out")) {
    if (bootPerfTimer) {
      clearInterval(bootPerfTimer);
      bootPerfTimer = null;
    }
    return;
  }

  const snapshot = getPerformanceTelemetrySnapshot();
  const memoryText = snapshot.memory
    ? `${snapshot.memory.usedMB.toFixed(1)} / ${snapshot.memory.totalMB.toFixed(1)} MB`
    : t("common.dash");
  setText("boot-perf-fps", String(snapshot.fps));
  setText("boot-perf-frame", `${snapshot.avgMs.toFixed(1)} / ${snapshot.maxMs.toFixed(1)} MS`);
  setText("boot-perf-ticks", snapshot.avgTicks.toFixed(1));
  setText(
    "boot-perf-entities",
    `B${snapshot.entities.bullets} E${snapshot.world.enemies} A${snapshot.world.asteroids} P${snapshot.entities.particles}`
  );
  setText("boot-perf-memory", memoryText);
}

function startBootPerformanceMonitor(): void {
  updateBootPerformanceMonitor();
  if (bootPerfTimer) return;
  bootPerfTimer = setInterval(updateBootPerformanceMonitor, 250);
}

export function stopBootPerformanceMonitor(): void {
  if (bootPerfTimer) {
    clearInterval(bootPerfTimer);
    bootPerfTimer = null;
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

    const progressFill = query(".ld-progress-fill");
    if (progressFill) {
      const widthByPhase: Record<string, string> = {
        start: "15%",
        ui: "45%",
        world: "75%",
        pixi: "100%",
      };
      setStyle(progressFill, { width: widthByPhase[name] ?? getStyleProperty(progressFill, "width") });
    }

    const subEl = getElement("ld-sub");
    if (subEl) {
      const subByPhase: Record<string, string> = {
        start: t("loading.init"),
        ui:    t("loading.hud"),
        world: t("loading.worldGen"),
        pixi:  t("loading.pixi"),
      };
      const text = subByPhase[name] ?? subEl.textContent ?? "";
      setDomText(subEl, text.replace(/^>\s*/, ""));
    }
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
