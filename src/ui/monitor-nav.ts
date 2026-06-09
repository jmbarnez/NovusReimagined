import { sfxBlip } from "../audio/procedural.js";
import { query, setHtml, onClick } from "./dom-helpers.js";

let _currentRestore: (() => void) | null = null;
let _currentOnRestore: ((container: HTMLElement) => void) | null = null;

function triggerRestore(): void {
  if (!_currentRestore) return;
  const onRestore = _currentOnRestore;
  _currentRestore();
  _currentRestore = null;
  _currentOnRestore = null;
  if (onRestore) {
    const restoredMonitor = query(".monitor-center .monitor-content");
    if (restoredMonitor) onRestore(restoredMonitor);
  }
}

/** Swap the left monitor content with new HTML. Returns cleanup function. */
export function swapMonitorContent(html: string, onReady?: (container: HTMLElement) => void): () => void {
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) {
    console.warn("Monitor content not found");
    return () => {};
  }

  // Store original content for back navigation
  const originalContent = monitor.innerHTML;

  // Replace with new content
  setHtml(monitor, html);

  // Call ready callback with the monitor container for event binding
  if (onReady) {
    onReady(monitor);
  }

  // Return function to restore original content
  return () => {
    setHtml(monitor, originalContent);
  };
}

/** Navigate to a sub-menu inside the left monitor. */
export function pushMonitorMenu(html: string, onReady: (container: HTMLElement) => void, onRestore?: (container: HTMLElement) => void): () => void {
  const restore = swapMonitorContent(html, onReady);

  _currentRestore = restore;
  _currentOnRestore = onRestore ?? null;

  // Bind inline back buttons
  setTimeout(() => {
    const monitor = query(".monitor-center .monitor-content");
    if (monitor) {
      monitor.querySelectorAll("[data-menu-back]").forEach((btn) => {
        onClick(btn, () => {
          sfxBlip();
          triggerRestore();
        });
      });
    }
  }, 0);

  return restore;
}
