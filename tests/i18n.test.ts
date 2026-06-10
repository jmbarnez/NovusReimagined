import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { t } from "../src/utils/i18n.js";
import { Client } from "../src/state.js";
import { STRINGS } from "../src/data/strings/index.js";

describe("i18n t()", () => {
  let originalLang: string;

  beforeEach(() => {
    originalLang = Client.settings.language;
  });

  afterEach(() => {
    Client.settings = { ...Client.settings, language: originalLang };
  });

  it("returns english string for existing key", () => {
    Client.settings = { ...Client.settings, language: "en" };
    expect(t("common.save")).toBe("SAVE");
  });

  it("returns spanish string for existing key", () => {
    Client.settings = { ...Client.settings, language: "es" };
    expect(t("common.save")).toBe("GUARDAR");
  });

  it("interpolates variables into translated string", () => {
    Client.settings = { ...Client.settings, language: "en" };
    const result = t("combat.destroyed", { name: "Drone", xp: 100, credits: 500 });
    expect(result).toBe("Destroyed Drone — +100 XP · ~500 CR loot");
  });

  it("returns the raw key when translation is missing", () => {
    Client.settings = { ...Client.settings, language: "en" };
    expect(t("nonexistent.key.here")).toBe("nonexistent.key.here");
  });

  it("falls back to key for unknown language", () => {
    Client.settings = { ...Client.settings, language: "xx" as "en" | "es" };
    expect(t("common.save")).toBe("common.save");
  });

  it("returns key when language map is missing entirely", () => {
    Client.settings = { ...Client.settings, language: "zz" as "en" | "es" };
    expect(t("common.save")).toBe("common.save");
  });
});

describe("i18n string module coverage", () => {
  it("has matching keys between en and es for every string module", () => {
    const enKeys = Object.keys(STRINGS.en).sort();
    const esKeys = Object.keys(STRINGS.es).sort();

    const enOnly = enKeys.filter((k) => !(k in STRINGS.es));
    const esOnly = esKeys.filter((k) => !(k in STRINGS.en));

    if (enOnly.length > 0) {
      console.warn("Keys missing in es:", enOnly.slice(0, 10));
    }
    if (esOnly.length > 0) {
      console.warn("Keys missing in en:", esOnly.slice(0, 10));
    }

    expect(enOnly).toEqual([]);
    expect(esOnly).toEqual([]);
  });

  it("has no empty translations", () => {
    for (const lang of ["en", "es"] as const) {
      const map = STRINGS[lang];
      for (const [key, val] of Object.entries(map)) {
        expect(val, `Empty translation for ${lang}.${key}`).not.toBe("");
      }
    }
  });
});
