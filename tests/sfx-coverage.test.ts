import { describe, expect, it } from "vitest";

interface RawGlobImportMeta extends ImportMeta {
  glob: (
    pattern: string[],
    options: { query: "?raw"; import: "default"; eager: true },
  ) => Record<string, string>;
}

describe("SFX coverage guard", () => {
  it("every exported sfx* function has at least one non-definition call site", () => {
    // 1. Read every audio procedural source file
    const audioFiles = (import.meta as RawGlobImportMeta).glob(
      ["../src/audio/procedural/**/*.ts"],
      { query: "?raw", import: "default", eager: true },
    );

    // 2. Collect exported function names matching sfx[A-Z]...
    const exported = new Set<string>();
    for (const [file, text] of Object.entries(audioFiles)) {
      const lines = text.split("\n");
      for (const line of lines) {
        const m = line.match(/export\s+function\s+(sfx[A-Z]\w+)\s*\(/);
        if (m) exported.add(m[1]);
      }
    }

    // 3. Read every src file (excluding tests and audio files themselves)
    const srcFiles = (import.meta as RawGlobImportMeta).glob(
      ["../src/**/*.ts", "../src/**/*.tsx"],
      { query: "?raw", import: "default", eager: true },
    );

    const callCounts = new Map<string, number>();
    for (const fn of exported) callCounts.set(fn, 0);

    for (const [file, text] of Object.entries(srcFiles)) {
      // Skip the audio directory — we already scanned those for exports,
      // and internal calls inside audio/ are legitimate call sites.
      // We actually WANT to count internal callers, so we do NOT skip audio/.
      const lines = text.split("\n");
      for (const line of lines) {
        for (const fn of exported) {
          const callRe = new RegExp(`\\b${fn}\\(`);
          if (callRe.test(line)) {
            // Exclude the function definition itself
            if (!line.includes(`function ${fn}(`)) {
              callCounts.set(fn, (callCounts.get(fn) || 0) + 1);
            }
          }
        }
      }
    }

    const orphans: string[] = [];
    for (const [fn, count] of callCounts) {
      if (count === 0) orphans.push(fn);
    }

    expect(orphans).toEqual([]);
  });
});
