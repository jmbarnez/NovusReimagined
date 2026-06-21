/**
 * Guard test: no `src/**` file may import from `canvas.js`.
 *
 * The screen `<canvas id="c">` and `src/canvas.ts` were deleted in PR 6 after
 * every Canvas 2D renderer was migrated to Pixi. If a future change re-adds a
 * `from "../canvas.js"` import, that path no longer exists and the typecheck
 * would fail, but this guard makes the intent explicit and surfaces the
 * regression in a focused test.
 */
import { describe, expect, it } from "vitest";

interface RawGlobImportMeta extends ImportMeta {
  glob: (
    pattern: string[],
    options: { query: "?raw"; import: "default"; eager: true },
  ) => Record<string, string>;
}

describe("Canvas 2D ban", () => {
  it("no src/ file imports from the removed canvas.js shim", () => {
    const files = (import.meta as RawGlobImportMeta).glob(
      ["../src/**/*.ts", "../src/**/*.tsx"],
      { query: "?raw", import: "default", eager: true },
    );

    const offenders = Object.entries(files).flatMap(([file, text]) => {
      if (file.endsWith("tests/canvas-2d-ban.test.ts")) return [];
      if (/\bfrom\s+["'][^"']*canvas(\.js)?["']/.test(text)) return [file];
      return [];
    });

    expect(offenders).toEqual([]);
  });

  it("src/canvas.ts is gone", () => {
    const files = (import.meta as RawGlobImportMeta).glob(
      ["../src/canvas.ts"],
      { query: "?raw", import: "default", eager: true },
    );
    expect(Object.keys(files)).toEqual([]);
  });

  it("no src/ file queries the removed screen canvas", () => {
    const files = (import.meta as RawGlobImportMeta).glob(
      ["../src/**/*.ts", "../src/**/*.tsx"],
      { query: "?raw", import: "default", eager: true },
    );

    const offenders = Object.entries(files).flatMap(([file, text]) => {
      if (/getElementById\(\s*["']c["']\s*\)/.test(text)) return [file];
      return [];
    });

    expect(offenders).toEqual([]);
  });
});
