import { ICON_LOGICAL, ICON_TEX_SCALE } from "./painters/shared.js";
import { paintItemIcon } from "./item-icon-paint.js";
import { hasAtlasFrame, preloadAtlasImage, renderAtlasSprite } from "./icon-atlas.js";
import { allIconCatalogIds } from "./icon-resolver.js";

const _cache = new Map<string, string>();

const FALLBACK_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeCanvas(): { c: HTMLCanvasElement; cx: CanvasRenderingContext2D; half: number } | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  const physical = ICON_LOGICAL * ICON_TEX_SCALE;
  c.width = physical;
  c.height = physical;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.scale(ICON_TEX_SCALE, ICON_TEX_SCALE);
  return { c, cx, half: ICON_LOGICAL / 2 };
}

/** Runtime canvas bake fallback when atlas frame is missing. */
export function bakeItemIcon(id: string): string {
  const cached = _cache.get(id);
  if (cached) return cached;

  const canvas = makeCanvas();
  if (!canvas) {
    _cache.set(id, FALLBACK_ICON);
    return FALLBACK_ICON;
  }

  const { c, cx } = canvas;
  cx.clearRect(0, 0, ICON_LOGICAL, ICON_LOGICAL);

  try {
    paintItemIcon(cx, id, ICON_LOGICAL);
  } catch {
    /* incomplete canvas mocks in test environments */
  }

  let dataUrl = FALLBACK_ICON;
  try {
    const baked = c.toDataURL("image/png");
    if (baked && baked.startsWith("data:image/png")) dataUrl = baked;
  } catch {
    /* jsdom / headless environments may lack toDataURL */
  }
  _cache.set(id, dataUrl);
  return dataUrl;
}

/** HTML for DOM insertion at arbitrary display size (atlas sprite preferred). */
export function itemIconHtml(id: string, size = 24): string {
  const sprite = renderAtlasSprite(id, size);
  if (sprite) return sprite;

  const src = bakeItemIcon(id);
  return `<img class="item-icon-img" src="${src}" width="${size}" height="${size}" draggable="false" alt="" />`;
}

/** Preload atlas texture; optionally warm runtime bake cache for missing ids. */
export function prewarmItemIcons(ids?: string[]): void {
  preloadAtlasImage();
  const list = ids ?? allIconCatalogIds();
  for (const id of list) {
    if (!hasAtlasFrame(id)) bakeItemIcon(id);
  }
}

export function clearItemIconCache(): void {
  _cache.clear();
}

export { resolveIcon } from "./icon-resolver.js";
export { paintItemIcon } from "./item-icon-paint.js";
