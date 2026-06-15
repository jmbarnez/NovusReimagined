import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { getTutorialSnapshot, initTutorial } from "../src/tutorial/index.js";
import { syncTutorialVisuals, clearTutorialVisuals } from "../src/tutorial/ui/visuals.js";
import { tutorialState } from "../src/tutorial/ui/state.js";
import { stationState } from "../src/ui/station/shared.js";
import { activateStationTab } from "../src/ui/station/tabs.js";
import { emit, on } from "../src/events.js";
import { makeStation, nextAnimationFrame } from "./tutorial-helpers.js";

describe("station tutorial spotlight", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    tutorialState.visible = true;
    Client.stationOpen = true;
    document.body.innerHTML = `
      <div id="station-overlay">
        <div id="st-ui">
          <button class="st-tab active" data-tab="hangar"></button>
          <button class="st-tab" data-tab="market"></button>
          <div id="panel-hangar" class="panel active"></div>
          <div id="panel-market" class="panel"></div>
          <div id="hangar-pane-cargo"></div>
          <div id="hangar-slot-high-0" data-rack="high" data-idx="0"></div>
          <div id="hangar-slot-high-1" data-rack="high" data-idx="1"></div>
        </div>
        <div id="st-dimmer"></div>
      </div>
    `;
  });

  afterEach(() => {
    clearTutorialVisuals();
    Client.stationOpen = false;
    document.getElementById("station-overlay")?.remove();
    if (!document.getElementById("c")) {
      const canvas = document.createElement("canvas");
      canvas.id = "c";
      document.body.appendChild(canvas);
    }
  });

  it("cuts the station dimmer around the highlighted hangar target", () => {
    const dimmer = document.getElementById("st-dimmer")!;
    const target = document.getElementById("hangar-pane-cargo")!;
    Object.defineProperty(dimmer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    });
    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 100, top: 120, right: 300, bottom: 220, width: 200, height: 100 }),
    });

    syncTutorialVisuals({ hangarReviewPhase: 0 });

    const segments = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
    expect(segments).toHaveLength(4);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(segments[0].style.height).toBe("112px");
    expect(segments[1].style.top).toBe("228px");
    expect(segments[2].style.width).toBe("92px");
    expect(segments[3].style.left).toBe("308px");

    clearTutorialVisuals();

    expect(dimmer.classList.contains("active")).toBe(false);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(false);
    for (const segment of segments) {
      expect(segment.getAttribute("style")).toBeNull();
    }
  });

  it("resyncs the hangar highlight after deferred station-open tutorial setup", async () => {
    const events: string[] = [];
    const off = on("tutorial:hangar-tour-change", () => {
      events.push("change");
      syncTutorialVisuals(getTutorialSnapshot());
    });

    try {
      initTutorial();
      emit("station:open", { station: makeStation() });

      await nextAnimationFrame();

      const snapshot = getTutorialSnapshot();
      const target = document.getElementById("hangar-pane-cargo")!;
      expect(snapshot.hangarReviewStarted).toBe(true);
      expect(snapshot.hangarReviewPhase).toBe(0);
      expect(events.length).toBeGreaterThan(0);
      expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    } finally {
      off();
    }
  });

  it("locks station tabs to the active tutorial tour target", () => {
    const root = document.getElementById("station-overlay")!;
    const target = document.getElementById("hangar-pane-cargo")!;

    syncTutorialVisuals({ hangarReviewPhase: 0 });
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);

    const switched = activateStationTab("market", root);
    expect(switched).toBe(false);
    expect(document.getElementById("panel-market")?.classList.contains("active")).toBe(false);
    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(true);

    syncTutorialVisuals({ hangarReviewPhase: 0 });

    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(true);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
  });

  it("uses the combat hangar phase to highlight high-slot tutorial targets", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-turrets");
    const firstSlot = document.getElementById("hangar-slot-high-0")!;
    const secondSlot = document.getElementById("hangar-slot-high-1")!;

    syncTutorialVisuals({ hangarCombatPhase: 1 });
    expect(firstSlot.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(secondSlot.classList.contains("tutorial-hangar-highlight")).toBe(false);

    syncTutorialVisuals({ hangarCombatPhase: 2 });
    expect(firstSlot.classList.contains("tutorial-hangar-highlight")).toBe(false);
    expect(secondSlot.classList.contains("tutorial-hangar-highlight")).toBe(true);
  });

  it("uses an inset border highlight that cannot be clipped by overflow:hidden ancestors", () => {
    const el = document.createElement("div");
    el.classList.add("tutorial-hangar-highlight");
    document.body.appendChild(el);

    const style = window.getComputedStyle(el);
    // The old buggy style used outline with a 4px offset; the fix removes it.
    expect(style.outlineStyle).toBe("none");
    expect(style.outlineOffset).toBe("0");
    // Border is drawn with a CSS variable so JSDOM reports the resolved shorthand.
    expect(style.border).not.toBe("");

    el.remove();
  });

  it("cuts the station dimmer around the highlighted refinery target", () => {
    Client.stationOpen = true;
    Client.activeStation = {
      id: "academy",
      name: "S.T.A.R.T Academy",
      x: 0,
      y: 0,
      radius: 240,
      spin: 0,
      isHome: true,
      safeRadius: 420,
      turrets: [],
      services: ["market", "industry", "repair"],
    };
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "industry");
    document.body.innerHTML = `
      <div id="station-overlay">
        <div id="st-ui">
          <button class="st-tab active" data-tab="industry"></button>
          <div id="panel-industry" class="panel active">
            <div id="refinery-pipeline"></div>
            <div id="refinery-process-source"></div>
            <div id="refinery-process-controls"></div>
            <aside id="refinery-right-rail"></aside>
          </div>
        </div>
        <div id="st-dimmer"></div>
      </div>
    `;

    const dimmer = document.getElementById("st-dimmer")!;
    const originalTarget = document.getElementById("refinery-process-controls")!;
    Object.defineProperty(dimmer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    });
    Object.defineProperty(originalTarget, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 160, top: 260, right: 420, bottom: 340, width: 260, height: 80 }),
    });

    syncTutorialVisuals({ refineryGuidePhase: 3 });

    const target = document.getElementById("refinery-process-controls")!;
    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 160, top: 260, right: 420, bottom: 340, width: 260, height: 80 }),
    });
    syncTutorialVisuals({ refineryGuidePhase: 3 });

    const segments = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
    expect(segments).toHaveLength(4);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(segments[0].style.height).toBe("252px");
    expect(segments[1].style.top).toBe("348px");
    expect(segments[2].style.width).toBe("152px");
    expect(segments[3].style.left).toBe("428px");
    expect(stationState.indRailTab).toBe("queue");

    syncTutorialVisuals({ refineryGuidePhase: 4 });
    expect(stationState.indRailTab).toBe("queue");
  });

  it("clears spotlight overlays when the current tutorial step is complete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    Client.stationOpen = false;
    document.body.innerHTML = `
      <div id="hud-dock-prompt"></div>
      <div id="hud-dimmer"></div>
    `;

    syncTutorialVisuals({ hangarReviewStarted: true, hangarReviewComplete: true });

    const target = document.getElementById("hud-dock-prompt")!;
    const dimmer = document.getElementById("hud-dimmer")!;
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(false);
    expect(dimmer.classList.contains("active")).toBe(false);
  });
});
