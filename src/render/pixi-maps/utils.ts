/** Convert rgba(r,g,b,a) or #rrggbb string to PixiJS hex number. */
export function rgbaToHex(color: string): number {
  color = color.trim();
  if (color.startsWith("rgba(")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return (r << 16) | (g << 8) | b;
    }
  }
  if (color.startsWith("#")) {
    return parseInt(color.replace("#", "0x"), 16);
  }
  return 0x37556e; // fallback
}

export type LabelStyleKind = "name" | "small" | "bold";

export interface MapWindowBounds {
  baseX: number;
  baseY: number;
  width: number;
  height: number;
}
