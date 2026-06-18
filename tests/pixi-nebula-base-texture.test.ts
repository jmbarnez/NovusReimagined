/**
 * Guard test: the GPU nebula must not be created with Texture.EMPTY.
 *
 * PixiJS v8's filter system can skip or miscalculate bounds for sprites whose
 * texture has no pixels. The nebula mesh therefore uses a generated 1x1 black
 * base texture. This guard catches regressions that would revert it to
 * Texture.EMPTY.
 */
import { describe, expect, it } from "vitest";

interface RawGlobImportMeta extends ImportMeta {
  glob: (
    pattern: string[],
    options: { query: "?raw"; import: "default"; eager: true },
  ) => Record<string, string>;
}

describe("nebula base texture guard", () => {
  it("pixi-nebula-gpu.ts does not use Texture.EMPTY for the nebula sprite", () => {
    const files = (import.meta as RawGlobImportMeta).glob(
      ["../src/render/pixi-nebula-gpu.ts"],
      { query: "?raw", import: "default", eager: true },
    );

    const source = Object.values(files)[0] ?? "";

    // Find the initNebulaMesh body: from the function declaration to the
    // following export, so we only flag Texture.EMPTY usage inside the
    // nebula sprite creation, not elsewhere in the file.
    const initMatch = source.match(/export function initNebulaMesh[\s\S]*?(?=export function updateNebulaMesh)/);
    const initBody = initMatch?.[0] ?? "";

    expect(initBody).not.toMatch(/new Sprite\(\s*Texture\.EMPTY\s*\)/);
    expect(initBody).toMatch(/new Sprite\(/);
  });
});
