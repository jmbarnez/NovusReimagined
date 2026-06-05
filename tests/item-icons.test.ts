import { describe, it, expect, beforeEach } from "vitest";
import { MODULES } from "../src/data/modules.js";
import { ORE, LOOT, COMPONENTS } from "../src/data/resources.js";
import {
  resolveIcon,
  EXPECTED_MODULE_FAMILIES,
  allIconCatalogIds,
} from "../src/ui/icons/icon-resolver.js";
import { bakeItemIcon, clearItemIconCache, itemIconHtml } from "../src/ui/icons/item-icon-bake.js";
import { getAtlasFrame, getIconAtlasManifest } from "../src/ui/icons/icon-atlas.js";

describe("item icon resolver", () => {
  it("maps every module id to a specific family (not rack fallback)", () => {
    for (const id of Object.keys(MODULES)) {
      const resolved = resolveIcon(id);
      const expected = EXPECTED_MODULE_FAMILIES[id];
      expect(expected, `${id} missing from EXPECTED_MODULE_FAMILIES`).toBeDefined();
      expect(resolved.family).toBe(expected);
      expect(resolved.kind).not.toBe("rack-fallback");
    }
  });

  it("maps tu-civilian-cannon like tu-cannon with civilian tint", () => {
    const civ = resolveIcon("tu-civilian-cannon");
    const mil = resolveIcon("tu-cannon");
    expect(civ.family).toBe("dual-rail");
    expect(mil.family).toBe("dual-rail");
    expect(civ.isCivilian).toBe(true);
    expect(mil.isCivilian).toBe(false);
  });

  it("resolves every resource key with exact painters", () => {
    for (const id of [...Object.keys(ORE), ...Object.keys(LOOT), ...Object.keys(COMPONENTS)]) {
      const resolved = resolveIcon(id);
      expect(resolved.kind).toBe("exact");
    }
  });

  it("resolves ammo ids exactly", () => {
    expect(resolveIcon("ammo-hybrid").kind).toBe("exact");
    expect(resolveIcon("ammo-missile").kind).toBe("exact");
  });
});

describe("item icon atlas manifest", () => {
  it("lists a frame for every catalog id when baked", () => {
    const manifest = getIconAtlasManifest();
    const frameCount = Object.keys(manifest.frames).length;
    if (frameCount === 0) return;
    expect(frameCount).toBe(allIconCatalogIds().length);
    for (const id of allIconCatalogIds()) {
      expect(getAtlasFrame(id), id).toBeDefined();
    }
  });
});

describe("item icon bake", () => {
  beforeEach(() => {
    clearItemIconCache();
  });

  it("bakeItemIcon returns a PNG data URL", () => {
    for (const id of allIconCatalogIds()) {
      const url = bakeItemIcon(id);
      expect(url.startsWith("data:image/png"), id).toBe(true);
      expect(url.length).toBeGreaterThan(32);
    }
  });

  it("itemIconHtml returns atlas sprite or img tag", () => {
    const html = itemIconHtml("iron", 28);
    const usesAtlas = getAtlasFrame("iron") != null;
    if (usesAtlas) {
      expect(html).toContain("item-icon-sprite");
      expect(html).toContain('width:28px');
    } else {
      expect(html).toContain("<img");
      expect(html).toContain('width="28"');
      expect(html).toContain('class="item-icon-img"');
    }
  });

  it("caches baked icons", () => {
    const a = bakeItemIcon("crystal");
    const b = bakeItemIcon("crystal");
    expect(a).toBe(b);
  });
});
