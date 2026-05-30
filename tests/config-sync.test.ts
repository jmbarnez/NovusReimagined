import { describe, it, expect } from "vitest";
import { C } from "../src/config/index.js";
import {
  CAP_FIRE_SURCHARGE,
  XP_PER_KILL,
  XP_PER_MINE,
  PLAYER_PARTICIPATION_WINDOW_MS,
} from "../src/constants.js";
import { WEAPON_PROFILES } from "../src/data/weaponProfiles.js";
import { MODULES, MODULE_FLAGS } from "../src/data/modules.js";

describe("config/constants sync", () => {
  it("re-exports combat tuning from config", () => {
    expect(CAP_FIRE_SURCHARGE).toBe(C.COMBAT.CAP_FIRE_SURCHARGE);
    expect(XP_PER_KILL).toBe(C.COMBAT.XP.perKill);
    expect(XP_PER_MINE).toBe(C.COMBAT.XP.perMine);
    expect(PLAYER_PARTICIPATION_WINDOW_MS).toBe(C.COMBAT.PLAYER_PARTICIPATION_WINDOW_MS);
  });

  it("missile modules use missile weapon profiles", () => {
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!MODULE_FLAGS.isMissile(mod)) continue;
      const profile = WEAPON_PROFILES[id];
      expect(profile, `${id} missing weapon profile`).toBeDefined();
      expect(profile!.type).toBe("missile");
    }
  });
});
