import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type AuthorityRule = {
  root: string;
  label: string;
  pattern: RegExp;
  reason: string;
};

type BoundaryRule = {
  label: string;
  includes: string[];
  excludes?: string[];
  pattern: RegExp;
  reason: string;
};

const ROOT = process.cwd();
const AUTHORITY_RULES: AuthorityRule[] = [
  {
    root: join(ROOT, "src", "sim"),
    label: "simulation-authority",
    pattern: /\bG\.P\b/,
    reason: "uses G.P; use the authoritative player parameter instead",
  },
  {
    root: join(ROOT, "src", "server"),
    label: "server-authority",
    pattern: /\bG\.P\b/,
    reason: "uses G.P; use the authoritative player/session state instead",
  },
];

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    label: "ui-sim-command-boundary",
    includes: ["src/ui/"],
    pattern: /from\s+["'][^"']*sim\/commands(?:\/[^"']*)?\.js["']/, 
    reason: "imports from sim/commands directly; queue actions through UI bridge/input layers",
  },
  {
    label: "entity-lifecycle-boundary",
    includes: ["src/"],
    excludes: ["src/utils/entities.ts"],
    pattern:
      /\bG\.(?:bullets|enemyBullets|beams|particles|shockwaves|floatTexts|trails|wreckPieces|salvagePickups|impactDecals)\s*(?:=|\.\s*(?:push|pop|splice|shift|unshift|sort|reverse|fill)\s*\()/,
    reason: "mutates simulation entity arrays directly; use src/utils/entities.ts helpers",
  },
  {
    label: "state-write-boundary",
    includes: ["src/"],
    excludes: ["src/state/access/", "src/state-access.ts", "src/player/player-stats.ts"],
    pattern: /\bG(?:\.P)?(?:\.[A-Za-z_]\w*)+\s*(?:=|\+=|-=|\*=|\/=|%=|\?\?=|\|\|=|&&=)/,
    reason: "writes G/G.P directly; use state accessors",
  },
  {
    label: "state-array-mutation-boundary",
    includes: ["src/"],
    excludes: ["src/state/access/", "src/state-access.ts"],
    pattern: /\bG(?:\.P)?(?:\.[A-Za-z_]\w*)+\.\s*(?:push|pop|splice|shift|unshift|sort|reverse|fill)\s*\(/,
    reason: "mutates G/G.P arrays directly; use state accessors/helpers",
  },
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

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

function startsWithAny(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

const violations: string[] = [];

for (const rule of AUTHORITY_RULES) {
  const files = walk(rule.root);
  for (const file of files) {
    const relativeFile = toRepoRelative(file);
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!rule.pattern.test(lines[i])) continue;
      violations.push(`${relativeFile}:${i + 1} [${rule.label}] ${rule.reason}`);
    }
  }
}

const sourceFiles = walk(join(ROOT, "src"));
for (const file of sourceFiles) {
  const relativeFile = toRepoRelative(file);
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const rule of BOUNDARY_RULES) {
    if (!startsWithAny(relativeFile, rule.includes)) continue;
    if (rule.excludes && startsWithAny(relativeFile, rule.excludes)) continue;
    for (let i = 0; i < lines.length; i++) {
      if (!rule.pattern.test(lines[i])) continue;
      violations.push(`${relativeFile}:${i + 1} [${rule.label}] ${rule.reason}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary check failed:");
  for (const v of violations) console.error(`- ${v}`);
  console.error(
    "\nFix boundary violations by routing through state accessors, entity helpers, and sanctioned UI/sim bridges.",
  );
  process.exit(1);
}

console.log("Architecture boundary checks passed.");
