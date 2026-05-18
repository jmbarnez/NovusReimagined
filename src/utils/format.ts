export function fmtCompact(n: number): string {
  const x = Math.round(n);
  if (x >= 1000) return `${(x / 1000).toFixed(1)}k`;
  return String(x);
}

export function hotkeyBadge(i: number): string {
  return i === 9 ? "0" : String(i + 1);
}

export function escHtml(t: string): string {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtKey(code: string): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "Backquote") return "`";
  if (code === "Escape") return "Esc";
  if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "AltLeft" || code === "AltRight") return "Alt";
  return code;
}
