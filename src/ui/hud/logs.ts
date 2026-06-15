import "../styles/hud-logs.css";
import { MAX_LOG_ENTRIES } from "./state.js";
import { setHtml, createElement, append, setText, remove } from "../dom-helpers.js";

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
  setHtml(sink, "");
  for (const entry of logHistory) {
    appendLogEntryDirect(sink, entry);
  }
}

function appendLogEntryDirect(sink: HTMLElement, entryData: LogEntry): void {
  const wasNearBottom = sink.scrollHeight - sink.scrollTop <= sink.clientHeight + 10;
  const entry = createElement("div", `log-entry log-${entryData.type}`);
  setText(entry, entryData.prefix ? `[${entryData.time}] ${entryData.prefix} ${entryData.msg}` : `[${entryData.time}] ${entryData.msg}`);
  append(sink, entry);

  while (sink.children.length > MAX_LOG_ENTRIES) {
    if (sink.firstChild) remove(sink.firstChild as HTMLElement);
  }

  if (wasNearBottom) {
    sink.scrollTop = sink.scrollHeight;
  }
}

/* ── Event Log ── */
export function logEvent(msg: string, type: string = "info"): void {
  appendLogEntry(msg, type);
}
