import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfiles: vi.fn(() => [
    { id: "p1", pilotName: "Alpha", shipId: "scout", sysIdx: 0, level: 1, credits: 0, createdAt: "", updatedAt: "", playTimeMs: 0 },
  ] as unknown[]),
  deleteAllProfiles: vi.fn(() => {
    mocks.getProfiles.mockReturnValue([]);
  }),
  restoreTitleScreen: vi.fn(),
  bindTitleScreenEvents: vi.fn(),
}));

vi.mock("../src/data/profiles.js", () => ({
  getProfiles: mocks.getProfiles,
  getActiveProfileId: () => null,
  deleteProfile: vi.fn(),
  deleteAllProfiles: mocks.deleteAllProfiles,
  timeAgo: () => "just now",
  formatPlayTime: () => "0m",
}));

vi.mock("../src/ui/boot-screen/boot-screen-title.js", () => ({
  bindTitleScreenEvents: mocks.bindTitleScreenEvents,
  restoreTitleScreen: mocks.restoreTitleScreen,
}));

vi.mock("../src/ui/boot-screen/boot-screen-profile-continue.js", () => ({
  continueSavedProfile: vi.fn(),
}));

vi.mock("../src/ui/boot-screen/boot-screen-profile-creation.js", () => ({
  showProfileCreation: vi.fn(),
}));

vi.mock("../src/audio/procedural.js", () => ({
  sfxBlip: vi.fn(),
  sfxConfirm: vi.fn(),
}));

vi.mock("../src/data/ships.js", () => ({
  SHIPS: { scout: { name: "Scout" } },
}));

vi.mock("../src/state-access.js", () => ({
  getState: () => ({ GALAXY: [{ name: "Alpha Gate", security: 0.8 }] }),
}));

vi.mock("../src/utils/i18n.js", () => ({
  t: (key: string, _params?: Record<string, unknown>) => key,
}));

describe("profile selection delete all back button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfiles.mockReturnValue([
      { id: "p1", pilotName: "Alpha", shipId: "scout", sysIdx: 0, level: 1, credits: 0, createdAt: "", updatedAt: "", playTimeMs: 0 },
    ]);
  });

  async function flushTimers(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  it("back button returns to original content after delete all", async () => {
    const titleHtml = `<div class="ld-title">NOVUS</div><button id="title-sp">Single Player</button>`;
    document.body.innerHTML = `<div class="monitor-center"><div class="monitor-content">${titleHtml}</div></div>`;

    const originalConfirm = window.confirm;
    window.confirm = () => true;

    const { showProfileSelection } = await import("../src/ui/boot-screen/boot-screen-profiles.js");
    showProfileSelection();
    await flushTimers();

    const monitor = document.querySelector(".monitor-content") as HTMLElement;
    expect(monitor.querySelector(".profile-screen")).not.toBeNull();

    // Click Delete All
    const deleteAllBtn = monitor.querySelector("#profile-delete-all") as HTMLButtonElement;
    expect(deleteAllBtn).not.toBeNull();
    deleteAllBtn.click();
    await flushTimers();

    expect(mocks.deleteAllProfiles).toHaveBeenCalledTimes(1);

    // Click Back — should restore the title screen HTML that was present before push
    const backBtn = monitor.querySelector("[data-menu-back]") as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
    backBtn.click();
    await flushTimers();

    // Should be back to title screen, not profile selection
    expect(monitor.querySelector(".ld-title")).not.toBeNull();
    expect(monitor.querySelector(".profile-screen")).toBeNull();

    window.confirm = originalConfirm;
  });
});
