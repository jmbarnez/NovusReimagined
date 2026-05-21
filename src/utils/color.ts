// Shared color-string helpers for canvas/sprite baking.

const RGB_RE = /rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/;

/** Lighten an rgb()/rgba() string by adding `amt` to each channel (clamped to 255). */
export function lightenCol(col: string, amt: number): string {
  const m = col.match(RGB_RE);
  if (!m) return col;
  const r = Math.min(255, parseInt(m[1]) + amt);
  const g = Math.min(255, parseInt(m[2]) + amt);
  const b = Math.min(255, parseInt(m[3]) + amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}

/** Darken an rgb()/rgba() string by subtracting `amt` from each channel (clamped to 0). */
export function darkenCol(col: string, amt: number): string {
  const m = col.match(RGB_RE);
  if (!m) return col;
  const r = Math.max(0, parseInt(m[1]) - amt);
  const g = Math.max(0, parseInt(m[2]) - amt);
  const b = Math.max(0, parseInt(m[3]) - amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}
