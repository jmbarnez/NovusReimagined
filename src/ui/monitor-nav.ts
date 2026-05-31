import { sfxBlip } from "../audio/procedural.js";

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

  // Bind back buttons
  setTimeout(() => {
    const monitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
    if (monitor) {
      monitor.querySelectorAll("[data-menu-back]").forEach((btn) => {
        btn.addEventListener("click", () => {
          sfxBlip();
          restore();
          if (onRestore) {
            const restoredMonitor = document.querySelector(".monitor-center .monitor-content") as HTMLElement | null;
            if (restoredMonitor) onRestore(restoredMonitor);
          }
        });
      });
    }
  }, 0);

  return restore;
}
