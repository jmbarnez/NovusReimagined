import manifest from "../../data/icon-atlas.manifest.json";
import { escHtml } from "../../utils/format.js";

export interface IconAtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IconAtlasManifest {
  version: number;
  cellSize: number;
  atlasWidth: number;
  atlasHeight: number;
  imageUrl: string;
  frames: Record<string, IconAtlasFrame>;
  /** Per-id static URL overrides (hand-authored PNG/WebP). Takes priority over atlas. */
  overrides?: Record<string, string>;
}

const ATLAS = manifest as IconAtlasManifest;

let atlasImagePreloaded = false;

export function getIconAtlasManifest(): IconAtlasManifest {
  return ATLAS;
}

export function hasAtlasFrame(id: string): boolean {
  return Boolean(ATLAS.overrides?.[id] || ATLAS.frames[id]);
}

export function getAtlasFrame(id: string): IconAtlasFrame | null {
  return ATLAS.frames[id] ?? null;
}

/** Custom static asset URL for this id, if configured in manifest overrides. */
export function getIconOverrideUrl(id: string): string | null {
  return ATLAS.overrides?.[id] ?? null;
}

/** Warm the atlas texture in the browser image cache. */
export function preloadAtlasImage(): void {
  if (atlasImagePreloaded || typeof Image === "undefined") return;
  if (!ATLAS.frames || Object.keys(ATLAS.frames).length === 0) return;
  atlasImagePreloaded = true;
  const img = new Image();
  img.src = ATLAS.imageUrl;
}

export function renderAtlasSprite(id: string, size: number): string | null {
  const override = getIconOverrideUrl(id);
  if (override) {
    return `<img class="item-icon-img" src="${override}" width="${size}" height="${size}" draggable="false" alt="" />`;
  }

  const frame = getAtlasFrame(id);
  if (!frame) return null;

  const scale = size / frame.w;
  const bgW = ATLAS.atlasWidth * scale;
  const bgH = ATLAS.atlasHeight * scale;
  const bx = -frame.x * scale;
  const by = -frame.y * scale;

  return `<span class="item-icon-sprite" data-icon-id="${escHtml(id)}" role="img" aria-hidden="true" style="width:${size}px;height:${size}px;background-image:url(${ATLAS.imageUrl});background-size:${bgW}px ${bgH}px;background-position:${bx}px ${by}px"></span>`;
}
