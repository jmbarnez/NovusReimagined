import "../styles/hud-logs.css";
import { hudState, MAX_LOG_ENTRIES } from "./state.js";

let logSink: HTMLElement | null = null;
const pendingLogs: { msg: string; type: string; prefix?: string }[] = [];

export function registerLogSink(sink: HTMLElement | null) {
  logSink = sink;
}

export function flushPendingLogEntries() {
  if (!logSink) return;
  while (pendingLogs.length > 0) {
    const entry = pendingLogs.shift()!;
    appendLogEntryDirect(logSink, entry.msg, entry.type, entry.prefix);
  }
}

export function appendLogEntry(msg: string, type: string = "info", prefix?: string) {
  if (logSink) {
    appendLogEntryDirect(logSink, msg, type, prefix);
  } else {
    pendingLogs.push({ msg, type, prefix });
    logEvent(prefix ? `${prefix} ${msg}` : msg, type);
  }
}

function appendLogEntryDirect(sink: HTMLElement, msg: string, type: string, prefix?: string) {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  entry.textContent = prefix ? `[${time}] ${prefix} ${msg}` : `[${time}] ${msg}`;
  sink.appendChild(entry);

  if (sink === hudState.logEntries) {
    while (sink.children.length > MAX_LOG_ENTRIES) {
      sink.removeChild(sink.firstChild!);
    }
  }

  const isNearBottom = sink.scrollHeight - sink.scrollTop <= sink.clientHeight + 10;
  if (isNearBottom) {
    sink.scrollTop = sink.scrollHeight;
  }
}

/* ── Event Log ── */
export function logEvent(msg: string, type: string = "info") {
  if (!hudState.logEntries) return;
  appendLogEntryDirect(hudState.logEntries, msg, type);
}
