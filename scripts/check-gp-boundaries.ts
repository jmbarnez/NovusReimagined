import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Rule = {
  root: string;
  label: string;
};

const ROOT = process.cwd();
const RULES: Rule[] = [
  { root: join(ROOT, "src", "sim"), label: "simulation-authority" },
  { root: join(ROOT, "src", "server"), label: "server-authority" },
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const DISALLOWED_PATTERN = /\bG\.P\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    const dot = full.lastIndexOf(".");
    if (dot === -1) continue;
    const ext = full.slice(dot);
    if (SOURCE_EXTENSIONS.has(ext)) out.push(full);
  }
  return out;
}

function toRepoRelative(absPath: string): string {
  return absPath.slice(ROOT.length + 1).replaceAll("\\", "/");
}

const violations: string[] = [];

for (const rule of RULES) {
  const files = walk(rule.root);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!DISALLOWED_PATTERN.test(lines[i])) continue;
      violations.push(`${toRepoRelative(file)}:${i + 1} [${rule.label}] uses G.P`);
    }
  }
}

if (violations.length > 0) {
  console.error("G.P boundary check failed:");
  for (const v of violations) console.error(`- ${v}`);
  console.error(
    "\nUse the authoritative player parameter (e.g. p/session.playerState) in server/simulation layers.",
  );
  process.exit(1);
}

console.log("G.P boundary check passed.");
