import "../styles/hud-logs.css";
import { MAX_LOG_ENTRIES } from "./state.js";

interface LogEntry {
  msg: string;
  type: string;
  time: string;
  prefix?: string;
}

let logSink: HTMLElement | null = null;
const logHistory: LogEntry[] = [];

export function registerLogSink(sink: HTMLElement | null): void {
  logSink = sink;
  if (!logSink) return;
  renderLogHistory(logSink);
}

export function flushPendingLogEntries(): void {
  if (!logSink) return;
  renderLogHistory(logSink);
}

export function appendLogEntry(msg: string, type: string = "info", prefix?: string): void {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const entry = { msg, type, time, prefix };
  logHistory.push(entry);
  while (logHistory.length > MAX_LOG_ENTRIES) {
    logHistory.shift();
  }

  if (logSink) {
    appendLogEntryDirect(logSink, entry);
  }
}

function renderLogHistory(sink: HTMLElement): void {
  sink.innerHTML = "";
  for (const entry of logHistory) {
    appendLogEntryDirect(sink, entry);
  }
}

function appendLogEntryDirect(sink: HTMLElement, entryData: LogEntry): void {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${entryData.type}`;
  entry.textContent = entryData.prefix ? `[${entryData.time}] ${entryData.prefix} ${entryData.msg}` : `[${entryData.time}] ${entryData.msg}`;
  sink.appendChild(entry);

  while (sink.children.length > MAX_LOG_ENTRIES) {
    sink.removeChild(sink.firstChild!);
  }

  const isNearBottom = sink.scrollHeight - sink.scrollTop <= sink.clientHeight + 10;
  if (isNearBottom) {
    sink.scrollTop = sink.scrollHeight;
  }
}

/* ── Event Log ── */
export function logEvent(msg: string, type: string = "info"): void {
  appendLogEntry(msg, type);
}
