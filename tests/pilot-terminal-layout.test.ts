import { afterEach, describe, expect, it, vi } from "vitest";
import { createPilotTerminalOverlay } from "../src/ui/pilot-terminal/layout.js";

describe("createPilotTerminalOverlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts the pilot terminal layout and preserves its imperative API", () => {
    const onAbort = vi.fn();

    const terminal = createPilotTerminalOverlay({
      id: "pilot-terminal-test",
      title: "Neural Link",
      subtitle: "Sync",
      dashboardHtml: `<button type="button" data-test-action>Run</button>`,
      showAbort: true,
      abortLabel: "Abort",
      onAbort,
    });

    expect(terminal.root.id).toBe("pilot-terminal-test");
    expect(terminal.root.classList.contains("pilot-terminal-overlay")).toBe(true);
    expect(terminal.dashboardMain.querySelector("[data-test-action]")).toBeInstanceOf(HTMLButtonElement);
    expect(terminal.consoleEntries).toBeInstanceOf(HTMLElement);

    terminal.setStatus("Connected");
    expect(terminal.root.querySelector("[data-pilot-status]")?.textContent).toBe("Connected");

    const abortBtn = terminal.root.querySelector("[data-pilot-abort]") as HTMLButtonElement;
    abortBtn.click();
    expect(onAbort).toHaveBeenCalledTimes(1);

    terminal.remove();
    expect(document.getElementById("pilot-terminal-test")).toBeNull();
  });

  it("uses the dashboard as the log sink fallback when console is hidden", () => {
    const terminal = createPilotTerminalOverlay({
      id: "pilot-terminal-embedded",
      title: "Embedded",
      embedded: true,
      showConsole: false,
    });

    expect(terminal.root.classList.contains("pilot-terminal-overlay--embedded")).toBe(true);
    expect(terminal.consoleEntries).toBe(terminal.dashboardMain);
  });
});
