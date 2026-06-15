import { beforeEach, describe, expect, it } from "vitest";
import { appendLogEntry, registerLogSink } from "../src/ui/hud/logs.js";

describe("hud logs auto-scroll", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps view pinned to bottom when already near bottom", () => {
    const sink = document.createElement("div");
    document.body.appendChild(sink);
    registerLogSink(sink);

    Object.defineProperty(sink, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(sink, "scrollHeight", { configurable: true, get: () => sink.children.length * 20 });
    sink.scrollTop = 0;

    for (let i = 0; i < 5; i++) appendLogEntry(`line ${i}`, "chat");
    sink.scrollTop = sink.scrollHeight - sink.clientHeight;

    appendLogEntry("new line", "chat");

    expect(sink.scrollTop).toBe(sink.scrollHeight);
  });

  it("does not force-scroll when user is reading older entries", () => {
    const sink = document.createElement("div");
    document.body.appendChild(sink);
    registerLogSink(sink);

    Object.defineProperty(sink, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(sink, "scrollHeight", { configurable: true, get: () => sink.children.length * 20 });
    sink.scrollTop = 0;

    for (let i = 0; i < 15; i++) appendLogEntry(`line ${i}`, "chat");
    sink.scrollTop = 20;

    appendLogEntry("new line", "chat");

    expect(sink.scrollTop).toBe(20);
  });
});
