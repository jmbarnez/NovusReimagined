import { Client, AppMode, isPlayerReady, isGameplayPaused } from "../state.js";
import { getState } from "../state-access.js";
import { savePlayer } from "../player/player-data.js";
import { updatePerfOverlay } from "../render/perf-overlay.js";
import { initHudOverlay, destroyHudOverlay } from "../ui/hud-overlay.js";
import { destroyPixi } from "../pixi.js";
import { destroyPixiChatBubbles } from "../render/pixi-chat-bubbles.js";
import { TICK_DT, MAX_CATCH } from "../constants.js";
import { deinitInput } from "../input/index.js";
import { stopBootPerformanceMonitor } from "../ui/boot-screen/boot-screen-phases.js";
import { cleanupHudResize } from "../ui/hud/windows.js";
import { cleanupBridgeResize } from "../ui/bridge.js";
import { cleanupMainResizeListener } from "../main.js";
import {
  updateTrails,
  updateFloatTexts,
  updateParticles,
  updateShockwaves,
  updateBeams,
} from "../utils/entities.js";
import { createLocalInputFrame } from "../sim/input.js";
import { predictionManager } from "../net/prediction.js";
import { interpolationManager } from "../net/interpolation.js";
import { initChat, destroyChat } from "../ui/chat.js";
import { netLog, flushNetLogPending } from "../ui/net-console.js";
import { hudState } from "../ui/hud/state.js";
import { syncSpatialGrid } from "../utils/spatial.js";
import { tickTutorial } from "../tutorial/index.js";
import { on } from "../events.js";
import { transitionTo } from "../ui/transition-manager.js";
import { drawFrame } from "./render-pass.js";
import { dismissLoadingScreen } from "../ui/loading-screen.js";
import {
  gameClient,
  ensureGameplayConnected,
  updateHostHeartbeat,
  initHostBridgeListeners,
  stopMultiplayer,
} from "./multiplayer-host.js";

export {
  gameClient,
  getMultiplayerPort,
  ensureGameplayConnected,
  connectToRemote,
  VITE_DEV_PORT,
  VITE_PREVIEW_PORT,
  GAME_SERVER_PORT,
} from "./multiplayer-host.js";

let accumulator = 0;
let lastFrameTime = performance.now();
let gameStarted = false;
let rafId = 0;
let timeoutId: number | null = null;
let autoSaveTimer = 0;
let currentTick = 0;
let lastRenderedFrameTime = performance.now();

export interface EnterSpaceModeOptions {
  reconnectLocal?: boolean;
  onPhase?: (phase: "connecting" | "entering") => void;
}

function getFrameLimitMs(): number {
  const fpsLimit = Client.settings?.fpsLimit ?? 0;
  if (!Number.isFinite(fpsLimit) || fpsLimit <= 0) return 0;
  return 1000 / fpsLimit;
}

function isUnlimitedFps(): boolean {
  const fpsLimit = Client.settings?.fpsLimit ?? 0;
  return !Number.isFinite(fpsLimit) || fpsLimit <= 0;
}

function scheduleNextFrame(): void {
  if (!gameStarted) return;
  if (isUnlimitedFps()) {
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      loop(performance.now());
    }, 0);
    return;
  }
  rafId = requestAnimationFrame(loop);
}

function isSimulationTickMode(): boolean {
  return Client.mode === AppMode.SPACE || Client.mode === AppMode.STATION;
}

function runGameplayTick() {
  if (gameClient.connectionState !== "connected") return;

  if (getState().player) {
    syncSpatialGrid(getState().player.sysIdx);
  }
  const frame = createLocalInputFrame(currentTick);
  gameClient.sendInput(frame);
  predictionManager.addInput(frame);
  updateBeams(TICK_DT);
  updateParticles(TICK_DT);
  updateShockwaves(TICK_DT);
  updateFloatTexts(TICK_DT);
  updateTrails(TICK_DT);
  currentTick++;
}

function flushQueuedActionsWhilePaused() {
  if (gameClient.connectionState !== "connected") return;
  const frame = createLocalInputFrame(currentTick);
  if (frame.actions.length === 0) return;
  gameClient.sendInput(frame);
  currentTick++;
}

function canFlushPausedActions(): boolean {
  return isPlayerReady() && (Client.mode === AppMode.SPACE || Client.mode === AppMode.STATION) && isGameplayPaused();
}

const ticker = new Worker(new URL("../worker/ticker.worker.js", import.meta.url));

ticker.onmessage = () => {
  if (!gameStarted || !document.hidden) return;

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.25);
  lastFrameTime = now;

  if (isPlayerReady() && isSimulationTickMode() && !isGameplayPaused()) {
    accumulator += dt;
    let ran = 0;
    while (accumulator >= TICK_DT && ran < MAX_CATCH) {
      runGameplayTick();
      accumulator -= TICK_DT;
      ran++;
    }
    if (accumulator > MAX_CATCH * TICK_DT) accumulator = MAX_CATCH * TICK_DT;
  } else if (canFlushPausedActions()) {
    flushQueuedActionsWhilePaused();
  }
};

function onVisibilityChange() {
  if (!document.hidden) {
    lastFrameTime = performance.now();
    accumulator = 0;
  }
}

document.addEventListener("visibilitychange", onVisibilityChange);

function loop(now: number) {
  if (!gameStarted) return;
  scheduleNextFrame();

  // Always compute frame delta so simulation pacing is independent of render rate
  const frameTime = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  updateHostHeartbeat();

  let ticks = 0;
  if (isPlayerReady() && isSimulationTickMode() && !isGameplayPaused()) {
    accumulator += frameTime;
    while (accumulator >= TICK_DT && ticks < MAX_CATCH) {
      runGameplayTick();
      accumulator -= TICK_DT;
      ticks++;
    }
    if (accumulator > MAX_CATCH * TICK_DT) accumulator = MAX_CATCH * TICK_DT;

    autoSaveTimer += frameTime;
    if (autoSaveTimer >= 30) {
      autoSaveTimer = 0;
      savePlayer();
    }
  } else {
    autoSaveTimer = 0;
    if (canFlushPausedActions()) {
      flushQueuedActionsWhilePaused();
    }
  }

  if (isPlayerReady() && Client.mode === AppMode.SPACE && getState().player?.tutorial?.active) {
    tickTutorial(frameTime);
  }

  updatePerfOverlay(frameTime, ticks);

  const alpha = isGameplayPaused() ? 1 : accumulator / TICK_DT;
  if (gameClient.connectionState === "connected") {
    interpolationManager.update(performance.now());
  }

  // Frame limiter: gate rendering only, not simulation
  const frameLimitMs = getFrameLimitMs();
  let shouldRender = true;
  if (frameLimitMs > 0) {
    const elapsed = now - lastRenderedFrameTime;
    if (elapsed < frameLimitMs - 0.5) {
      shouldRender = false;
    } else {
      // Advance by exact interval to prevent drift and smooth cadence
      lastRenderedFrameTime += frameLimitMs;
      if (now - lastRenderedFrameTime > frameLimitMs) {
        lastRenderedFrameTime = now;
      }
    }
  } else {
    lastRenderedFrameTime = now;
  }

  if (shouldRender) {
    drawFrame(now, alpha, frameTime);
  }
}

function showSpaceHud() {
  initHudOverlay();
  const hud = document.getElementById("hud-overlay");
  if (hud) hud.style.display = "block";
}

export function initGameLoop() {
  gameStarted = true;
  lastFrameTime = performance.now();
  lastRenderedFrameTime = lastFrameTime;
  accumulator = 0;
  currentTick = 0;

  on("net:tick-sync", ({ tick, resetPrediction }) => {
    if (!Number.isFinite(tick)) {
      netLog(`[WARN] Ignored invalid tick sync: ${String(tick)}`);
      return;
    }
    if (tick !== currentTick) {
      netLog(`tick sync ${currentTick} → ${tick}`);
      currentTick = tick;
    }
    if (resetPrediction) {
      predictionManager.clear();
      interpolationManager.clear();
    }
  });

  initHostBridgeListeners();
  scheduleNextFrame();
}

export async function enterSpaceMode(opts: EnterSpaceModeOptions = {}) {
  const conn = gameClient.connectionState;
  netLog(`enterSpaceMode begin conn=${conn}${opts.reconnectLocal ? " reconnectLocal=true" : ""}`);

  try {
    if (opts.reconnectLocal || conn !== "connected") {
      opts.onPhase?.("connecting");
      const connected = await ensureGameplayConnected({ reconnectLocal: opts.reconnectLocal });
      if (!connected) {
        throw new Error("Authoritative gameplay connection failed");
      }
    } else {
      netLog("[OK] enterSpaceMode: already connected");
    }

    opts.onPhase?.("entering");
    dismissLoadingScreen();
    document.querySelectorAll(".title-screen").forEach((el) => el.remove());
    document
      .querySelectorAll("#pilot-join-screen, #pilot-host-screen, #pilot-profile-screen")
      .forEach((el) => el.remove());

    transitionTo(AppMode.SPACE);
    Client.gameStarted = true;

    if (!hudState.logEntries) initHudOverlay();
    flushNetLogPending();
    showSpaceHud();

    try {
      initChat();
    } catch (err) {
      netLog(`[WARN] initChat failed: ${err}`);
      console.warn("[GameLoop] initChat failed:", err);
    }

    try {
      window.dispatchEvent(new Event("resize"));
    } catch (err) {
      netLog(`[WARN] resize failed: ${err}`);
      console.warn("[GameLoop] resize failed:", err);
    }

    netLog(`[OK] enterSpaceMode complete conn=${gameClient.connectionState}`);
  } catch (err) {
    netLog(`[ERR] enterSpaceMode failed: ${err}`);
    console.error("[GameLoop] enterSpaceMode failed:", err);
    throw err;
  }
}

export function stopGameLoop() {
  gameStarted = false;
  cancelAnimationFrame(rafId);
  rafId = 0;
  if (timeoutId != null) {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }
  try {
    ticker.postMessage({ type: "stop" });
  } catch {
    // ignore
  }
  ticker.terminate();
  document.removeEventListener("visibilitychange", onVisibilityChange);

  stopBootPerformanceMonitor();
  deinitInput();
  cleanupMainResizeListener();
  cleanupHudResize();
  cleanupBridgeResize();
  stopMultiplayer();
  destroyHudOverlay();
  destroyChat();
  destroyPixiChatBubbles();
  destroyPixi();
}

// Dispose worker + listeners on HMR reload so dev sessions don't accumulate duplicates.
const meta = import.meta as ImportMeta & { hot?: { dispose: (cb: () => void) => void } };
if (meta.hot) {
  meta.hot.dispose(() => {
    stopGameLoop();
  });
}
