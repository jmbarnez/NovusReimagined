import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfiles: vi.fn(() => [] as unknown[]),
  restoreTitleScreen: vi.fn(),
  buildProfileSelectionHtml: vi.fn(() => "<div>profiles</div>"),
  bindProfileSelectionEvents: vi.fn(),
}));

vi.mock("../src/data/profiles.js", () => ({
  getProfiles: mocks.getProfiles,
  getActiveProfileId: () => null,
  createProfile: vi.fn(() => "new-id"),
  deleteProfile: vi.fn(),
  deleteAllProfiles: vi.fn(),
  timeAgo: () => "just now",
  formatPlayTime: () => "0m",
}));

vi.mock("../src/ui/boot-screen/boot-screen-title.js", () => ({
  bindTitleScreenEvents: vi.fn(),
  restoreTitleScreen: mocks.restoreTitleScreen,
}));

vi.mock("../src/ui/boot-screen/boot-screen-profiles.js", () => ({
  buildProfileSelectionHtml: mocks.buildProfileSelectionHtml,
  bindProfileSelectionEvents: mocks.bindProfileSelectionEvents,
  showProfileSelection: vi.fn(),
}));

vi.mock("../src/audio/procedural.js", () => ({
  sfxBlip: vi.fn(),
  sfxConfirm: vi.fn(),
}));

vi.mock("../src/data/ships.js", () => ({
  SHIPS: { scout: { name: "Scout" } },
}));

vi.mock("../src/state-access.js", () => ({
  getState: () => ({ player: { pilotName: "", sysIdx: 0, shipId: "scout", level: 1, credits: 0 }, GALAXY: [{ name: "Alpha", security: 0.8 }] }),
  WorldAccess: { initPlayer: vi.fn() },
}));

vi.mock("../src/player/player-data.js", () => ({
  makePlayer: () => ({ pilotName: "", sysIdx: 0, shipId: "scout", level: 1, credits: 0 }),
  validatePilotName: vi.fn(() => ({ ok: true, name: "TestPilot" })),
  loadPlayer: vi.fn(),
  savePlayer: vi.fn(),
}));

vi.mock("../src/game-loop.js", () => ({
  enterSpaceMode: vi.fn(),
}));

vi.mock("../src/ui/hud-overlay.js", () => ({
  logEvent: vi.fn(),
}));

vi.mock("../src/utils/i18n.js", () => ({
  t: (key: string, _params?: Record<string, unknown>) => key,
}));

vi.mock("../src/utils/restore-save.js", () => ({
  initGameSession: vi.fn(),
  restoreGameFromSave: vi.fn(),
}));

describe("profile creation back navigation", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="monitor-center"><div class="monitor-content"></div></div>`;
    vi.clearAllMocks();
  });

  async function flushTimers(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  it("returns to title screen when no profiles exist", async () => {
    mocks.getProfiles.mockReturnValue([]);

    const { showProfileCreation } = await import("../src/ui/boot-screen/boot-screen-profile-creation.js");
    showProfileCreation();

    await flushTimers();

    const backBtn = document.querySelector("[data-menu-back]") as HTMLButtonElement;
    expect(backBtn).not.toBeNull();

    backBtn.click();
    await flushTimers();

    expect(mocks.restoreTitleScreen).toHaveBeenCalledTimes(1);
    expect(mocks.buildProfileSelectionHtml).not.toHaveBeenCalled();
  });

  it("returns to profile selection when profiles exist", async () => {
    mocks.getProfiles.mockReturnValue([{ id: "p1", pilotName: "Test" }]);

    const { showProfileCreation } = await import("../src/ui/boot-screen/boot-screen-profile-creation.js");
    showProfileCreation();

    await flushTimers();

    const backBtn = document.querySelector("[data-menu-back]") as HTMLButtonElement;
    expect(backBtn).not.toBeNull();

    backBtn.click();
    await flushTimers();

    expect(mocks.restoreTitleScreen).not.toHaveBeenCalled();
    expect(mocks.buildProfileSelectionHtml).toHaveBeenCalledTimes(1);
    expect(mocks.bindProfileSelectionEvents).toHaveBeenCalledTimes(1);
  });
});
