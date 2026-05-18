import "../styles/hud-logs.css";
import { hudState, MAX_LOG_ENTRIES } from "./state.js";

/* ── Event Log ── */
export function logEvent(msg: string, type: string = "info") {
  if (!hudState.logEntries) return;
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  entry.textContent = `[${time}] ${msg}`;
  hudState.logEntries.appendChild(entry);

  while (hudState.logEntries.children.length > MAX_LOG_ENTRIES) {
    hudState.logEntries.removeChild(hudState.logEntries.firstChild!);
  }

  const isNearBottom = hudState.logEntries.scrollHeight - hudState.logEntries.scrollTop <= hudState.logEntries.clientHeight + 10;
  if (isNearBottom) {
    hudState.logEntries.scrollTop = hudState.logEntries.scrollHeight;
  }
}
