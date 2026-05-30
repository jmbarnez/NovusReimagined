import { describe, expect, it } from "vitest";

interface RawGlobImportMeta extends ImportMeta {
  glob: (
    pattern: string[],
    options: { query: "?raw"; import: "default"; eager: true },
  ) => Record<string, string>;
}

describe("server authority boundary", () => {
  it("does not depend on the local player singleton", () => {
    const files = (import.meta as RawGlobImportMeta).glob(
      ["../src/server/**/*.ts", "../src/sim/**/*.ts"],
      { query: "?raw", import: "default", eager: true },
    );

    const offenders = Object.entries(files).flatMap(([file, text]) => {
      return text.includes("G.P") ? [file] : [];
    });

    expect(offenders).toEqual([]);
  });
});
