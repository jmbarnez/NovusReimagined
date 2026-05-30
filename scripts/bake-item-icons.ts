/**
 * Build-time icon atlas generator.
 * Runs painters at 128×128, packs into public/assets/icons/atlas.png,
 * and writes src/data/icon-atlas.manifest.json for runtime sprite lookup.
 *
 * Usage: npm run bake:icons
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allIconCatalogIds } from "../src/ui/icons/icon-resolver.js";
import { paintItemIcon } from "../src/ui/icons/item-icon-paint.js";

const CELL = 128;
const COLS = 8;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "assets", "icons");
const manifestPath = join(root, "src", "data", "icon-atlas.manifest.json");

mkdirSync(outDir, { recursive: true });

const ids = [...allIconCatalogIds()].sort((a, b) => a.localeCompare(b));
const rows = Math.ceil(ids.length / COLS);
const atlasW = COLS * CELL;
const atlasH = rows * CELL;

const atlas = createCanvas(atlasW, atlasH);
const actx = atlas.getContext("2d");
actx.clearRect(0, 0, atlasW, atlasH);

const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};

for (let i = 0; i < ids.length; i++) {
  const id = ids[i]!;
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = col * CELL;
  const y = row * CELL;

  const cell = createCanvas(CELL, CELL);
  const cx = cell.getContext("2d");
  paintItemIcon(cx, id, CELL);

  actx.drawImage(cell, x, y);
  frames[id] = { x, y, w: CELL, h: CELL };
}

writeFileSync(join(outDir, "atlas.png"), atlas.toBuffer("image/png"));

const manifest = {
  version: 1,
  cellSize: CELL,
  atlasWidth: atlasW,
  atlasHeight: atlasH,
  imageUrl: "/assets/icons/atlas.png",
  frames,
  overrides: {} as Record<string, string>,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Baked ${ids.length} icons → ${atlasW}×${atlasH} atlas (${manifestPath})`);
