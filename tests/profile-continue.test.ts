import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProfileMeta } from "../src/data/profiles.js";

vi.setConfig({ testTimeout: 60000 });

type MockEnterOptions = {
  reconnectLocal?: boolean;
  onPhase?: (phase: "connecting" | "entering") => void;
};

const mocks = vi.hoisted(() => {
  const profile: ProfileMeta = {
    id: "profile-1",
    pilotName: "Test Pilot",
    shipId: "scout",
    sysIdx: 0,
    level: 3,
    credits: 1250,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    playTimeMs: 0,
  };

  const state = {
    GALAXY: [{ name: "Alpha Gate", security: 0.8 }],
    player: { sysIdx: 0 },
  };

  return {
    profile,
    state,
    activateProfile: vi.fn(() => true),
    restoreGameFromSave: vi.fn(() => true),
    enterSpaceMode: vi.fn((_opts?: MockEnterOptions) => Promise.resolve()),
    logEvent: vi.fn(),
    restoreTitleScreen: vi.fn(),
  };
});

vi.mock("../src/data/profiles.js", () => ({
  getProfiles: () => [mocks.profile],
  getActiveProfileId: () => mocks.profile.id,
  activateProfile: mocks.activateProfile,
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  timeAgo: () => "just now",
  formatPlayTime: (ms: number) => `${Math.floor(ms / 60000)}m`,
}));

vi.mock("../src/utils/restore-save.js", () => ({
  initGameSession: vi.fn(),
  restoreGameFromSave: mocks.restoreGameFromSave,
}));

vi.mock("../src/game-loop.js", () => ({
  enterSpaceMode: mocks.enterSpaceMode,
}));

vi.mock("../src/ui/hud-overlay.js", () => ({
  logEvent: mocks.logEvent,
}));

vi.mock("../src/ui/boot-screen/boot-screen-title.js", () => ({
  bindTitleScreenEvents: vi.fn(),
  restoreTitleScreen: mocks.restoreTitleScreen,
}));

vi.mock("../src/state-access.js", () => ({
  getState: () => mocks.state,
}));

vi.mock("../src/audio/procedural.js", () => ({
  sfxBlip: vi.fn(),
  sfxConfirm: vi.fn(),
}));

function makeDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 10));
}

describe("profile Continue loading gate", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="monitor-center"><div class="monitor-content"></div></div>`;
    mocks.activateProfile.mockClear();
    mocks.activateProfile.mockReturnValue(true);
    mocks.restoreGameFromSave.mockClear();
    mocks.restoreGameFromSave.mockReturnValue(true);
    mocks.enterSpaceMode.mockClear();
    mocks.enterSpaceMode.mockResolvedValue(undefined);
    mocks.logEvent.mockClear();
    mocks.restoreTitleScreen.mockClear();
  });

  it("disables Continue and ignores repeat clicks while the save load is pending", async () => {
    const deferred = makeDeferred<void>();
    mocks.enterSpaceMode.mockImplementation((opts?: MockEnterOptions) => {
      opts?.onPhase?.("connecting");
      return deferred.promise;
    });

    const { showProfileSelection } = await import("../src/ui/boot-screen/boot-screen-profiles.js");
    showProfileSelection();

    const continueBtn = document.querySelector("[data-profile-continue]") as HTMLButtonElement;
    continueBtn.click();
    continueBtn.click();
    await flushMicrotasks();

    expect(continueBtn.disabled).toBe(true);
    expect(mocks.activateProfile).toHaveBeenCalledTimes(1);
    expect(mocks.restoreGameFromSave).toHaveBeenCalledTimes(1);
    expect(mocks.enterSpaceMode).toHaveBeenCalledTimes(1);
    expect(mocks.enterSpaceMode).toHaveBeenCalledWith(expect.objectContaining({ reconnectLocal: true }));
    expect(document.body.textContent).toContain("Synchronizing authoritative state");
    expect(mocks.logEvent).not.toHaveBeenCalled();

    deferred.resolve();
    await flushMicrotasks();

    expect(mocks.logEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logEvent.mock.calls[0]?.[0]).toContain("Alpha Gate");
  });

  it("returns to profile selection when authoritative entry fails", async () => {
    mocks.enterSpaceMode.mockImplementation((opts?: MockEnterOptions) => {
      opts?.onPhase?.("connecting");
      return Promise.reject(new Error("connect failed"));
    });

    const { showProfileSelection } = await import("../src/ui/boot-screen/boot-screen-profiles.js");
    showProfileSelection();

    const continueBtn = document.querySelector("[data-profile-continue]") as HTMLButtonElement;
    continueBtn.click();
    await flushMicrotasks();

    expect(mocks.restoreTitleScreen).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-profile-continue]")).not.toBeNull();
    expect(document.body.textContent).toContain("Unable to restore that pilot link");
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });
});
