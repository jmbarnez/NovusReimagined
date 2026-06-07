import { sfxBlip } from "../audio/procedural.js";

let _currentRestore: (() => void) | null = null;
let _currentOnRestore: ((container: HTMLElement) => void) | null = null;

function triggerRestore(): void {
  if (!_currentRestore) return;
  const onRestore = _currentOnRestore;
  _currentRestore();
  _currentRestore = null;
  _currentOnRestore = null;
  if (onRestore) {
    const restoredMonitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
    if (restoredMonitor) onRestore(restoredMonitor);
  }
}

/** Swap the left monitor content with new HTML. Returns cleanup function. */
export function swapMonitorContent(html: string, onReady?: (container: HTMLElement) => void): () => void {
  const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
  if (!monitor) {
    console.warn("Monitor content not found");
    return () => {};
  }

  // Store original content for back navigation
  const originalContent = monitor.innerHTML;

  // Replace with new content
  monitor.innerHTML = html;

  // Call ready callback with the monitor container for event binding
  if (onReady) {
    onReady(monitor);
  }

  // Return function to restore original content
  return () => {
    monitor.innerHTML = originalContent;
  };
}

/** Navigate to a sub-menu inside the left monitor. */
export function pushMonitorMenu(html: string, onReady: (container: HTMLElement) => void, onRestore?: (container: HTMLElement) => void): () => void {
  const restore = swapMonitorContent(html, onReady);

  _currentRestore = restore;
  _currentOnRestore = onRestore ?? null;

  // Bind inline back buttons
  setTimeout(() => {
    const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
    if (monitor) {
      monitor.querySelectorAll("[data-menu-back]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sfxBlip();
          triggerRestore();
        });
      });
    }
  }, 0);

  return restore;
}
