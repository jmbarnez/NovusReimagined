import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

interface SourceFile {
  absPath: string;
  relPath: string;
  text: string;
}

interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
}

const root = process.cwd();
const srcRoot = join(root, "src");
const findings: Finding[] = [];

const entityArrays = [
  "bullets",
  "enemyBullets",
  "beams",
  "particles",
  "shockwaves",
  "floatTexts",
  "trails",
  "wreckPieces",
  "salvagePickups",
  "impactDecals",
] as const;

const entityArrayPattern = entityArrays.join("|");
const importFromPattern = /(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g;
const localPlayerSingletonPattern = /\b(?:_G|G)\.P\b/g;
const entityMutationPattern = new RegExp(
  `\\b(?:_G|G)\\.(${entityArrayPattern})(?:\\s*=(?!=)|\\.length\\s*=(?!=)|\\.(?:push|splice|pop|shift|unshift|fill|sort|reverse)\\s*\\()`,
  "g",
);
const stateWritePattern = /\b(?:_G|G)\.(?!P\b)([A-Za-z_]\w*)\s*=(?!=)/g;
const localPlayerWritePattern = /\b(?:_G|G)\.P(?:\.[A-Za-z_]\w+)?\s*=(?!=)/g;
const localPlayerArrayMutationPattern = /\b(?:_G|G)\.P\.[A-Za-z_]\w+\.(?:push|splice|pop|shift|unshift|fill|sort|reverse)\s*\(/g;

function toRepoPath(absPath: string): string {
  return relative(root, absPath).replace(/\\/g, "/");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absPath, out);
      continue;
    }
    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(absPath);
    }
  }
  return out;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function addFinding(rule: string, file: SourceFile, index: number, message: string): void {
  findings.push({ rule, file: file.relPath, line: lineAt(file.text, index), message });
}

function isStateWriteAllowed(relPath: string): boolean {
  return (
    relPath === "src/state.ts" ||
    relPath === "src/state-access.ts" ||
    relPath === "src/player-registry.ts" ||
    relPath.startsWith("src/state/access/") ||
    relPath === "src/utils/entities.ts" ||
    relPath.startsWith("src/utils/entities/")
  );
}

function isEntityLifecycleAllowed(relPath: string): boolean {
  return relPath === "src/utils/entities.ts" || relPath.startsWith("src/utils/entities/");
}

function checkServerAuthority(file: SourceFile): void {
  if (!file.relPath.startsWith("src/server/") && !file.relPath.startsWith("src/sim/")) return;
  for (const match of file.text.matchAll(localPlayerSingletonPattern)) {
    addFinding(
      "server-authority",
      file,
      match.index ?? 0,
      "server/sim modules must not depend on the local-player singleton; pass an explicit Player instead.",
    );
  }
}

function checkUiCommandBoundary(file: SourceFile): void {
  if (!file.relPath.startsWith("src/ui/")) return;
  for (const match of file.text.matchAll(importFromPattern)) {
    const spec = match[1];
    if (!spec.includes("sim/commands")) continue;
    addFinding(
      "ui-sim-command-boundary",
      file,
      match.index ?? 0,
      "UI may queue frame actions through sim/input, but must not import command execution/types from sim/commands directly.",
    );
  }
}

function checkEntityLifecycle(file: SourceFile): void {
  if (isEntityLifecycleAllowed(file.relPath)) return;
  for (const match of file.text.matchAll(entityMutationPattern)) {
    addFinding(
      "entity-lifecycle-boundary",
      file,
      match.index ?? 0,
      "simulation entity arrays must be mutated through src/utils/entities lifecycle helpers.",
    );
  }
}

function checkStateWrites(file: SourceFile): void {
  if (isStateWriteAllowed(file.relPath)) return;
  for (const match of file.text.matchAll(stateWritePattern)) {
    addFinding(
      "state-write-boundary",
      file,
      match.index ?? 0,
      "global state writes must go through state accessors or canonical lifecycle helpers.",
    );
  }
  for (const match of file.text.matchAll(localPlayerWritePattern)) {
    addFinding(
      "state-write-boundary",
      file,
      match.index ?? 0,
      "local player singleton writes must go through PlayerAccess/WorldAccess.",
    );
  }
  for (const match of file.text.matchAll(localPlayerArrayMutationPattern)) {
    addFinding(
      "state-array-mutation-boundary",
      file,
      match.index ?? 0,
      "local player array mutations must go through PlayerAccess methods.",
    );
  }
}

function checkCanvasBoundary(file: SourceFile): void {
  const canvasImportPattern = /\bfrom\s+["'][^"']*canvas(?:\.js)?["']/g;
  for (const match of file.text.matchAll(canvasImportPattern)) {
    addFinding(
      "pixi-render-boundary",
      file,
      match.index ?? 0,
      "the removed canvas.js renderer must not be imported; gameplay rendering belongs in Pixi.",
    );
  }

  const screenCanvasPattern = /getElementById\(\s*["']c["']\s*\)/g;
  for (const match of file.text.matchAll(screenCanvasPattern)) {
    addFinding(
      "pixi-render-boundary",
      file,
      match.index ?? 0,
      "the removed screen canvas id \"c\" must not be queried; gameplay rendering belongs in Pixi.",
    );
  }
}

if (!existsSync(srcRoot)) {
  console.error("Architecture lint failed: src/ directory was not found.");
  process.exit(1);
}

const files: SourceFile[] = walk(srcRoot).map((absPath) => ({
  absPath,
  relPath: toRepoPath(absPath),
  text: readFileSync(absPath, "utf8"),
}));

for (const file of files) {
  checkServerAuthority(file);
  checkUiCommandBoundary(file);
  checkEntityLifecycle(file);
  checkStateWrites(file);
  checkCanvasBoundary(file);
}

if (findings.length > 0) {
  console.error(`Architecture lint failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}

console.log(`Architecture lint passed (${files.length} source files checked).`);
