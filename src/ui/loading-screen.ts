import { t } from "../utils/i18n.js";

const LOADING_FADE_MS = 350;

/** Fade out and remove the HTML-first loading splash. */
export function dismissLoadingScreen(): void {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.add("out");
  el.style.pointerEvents = "none";
}

/** Record boot milestones for DevTools / cold-start diagnostics and loading screen logs. */
export function markBootPhase(name: string): void {
  try {
    performance.mark(`novus:boot:${name}`);
    
    // Dynamically append logs to the loading console if it exists
    const consoleEl = document.querySelector(".ld-console");
    if (consoleEl) {
      let lines: string[] = [];
      if (name === "start") {
        consoleEl.innerHTML = ""; // Clear initial logs
        lines = [
          t("loading.init"),
          t("loading.network"),
          t("loading.neural")
        ];
      } else if (name === "ui") {
        lines = [
          t("loading.hud"),
          t("loading.hudMapping"),
          t("loading.hudLoaded")
        ];
      } else if (name === "world") {
        lines = [
          t("loading.worldGen"),
          t("loading.worldPop"),
          t("loading.worldGrid")
        ];
      } else if (name === "pixi") {
        lines = [
          t("loading.pixi"),
          t("loading.pixiTextures"),
          t("loading.pixiShaders")
        ];
      }
      
      for (const line of lines) {
        const div = document.createElement("div");
        div.className = "ld-console-line";
        div.textContent = line;
        consoleEl.appendChild(div);
      }
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    // Dynamically update the visual progress bar fill
    const progressFill = document.querySelector(".ld-progress-fill") as HTMLElement | null;
    if (progressFill) {
      let width = "0%";
      if (name === "start") width = "15%";
      else if (name === "ui") width = "45%";
      else if (name === "world") width = "75%";
      else if (name === "pixi") width = "100%";
      progressFill.style.width = width;
    }
  } catch {
    /* performance API / DOM unavailable */
  }
}

/** Log boot duration from HTML parse through title-ready (local dev only). */
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
      console.info(
        `[novus boot] html→title: ${totalMs.toFixed(0)}ms | boot(): ${bootMs.toFixed(0)}ms`,
      );
    }
    performance.measure("novus:boot:total", "novus:html-parsed", "novus:boot:title-ready");
  } catch {
    /* ignore measurement failures */
  }
}
