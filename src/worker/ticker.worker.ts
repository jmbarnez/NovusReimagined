// Fires at ~60 ticks/sec regardless of tab visibility.
// Workers are not subject to rAF suspension and are much less throttled
// than main-thread timers when the browser window is minimized.
const INTERVAL_MS = 1000 / 60;
const handle = setInterval(() => self.postMessage(1), INTERVAL_MS);
self.addEventListener("message", (e: MessageEvent) => {
  if ((e.data as { type?: string } | null)?.type === "stop") clearInterval(handle);
});
