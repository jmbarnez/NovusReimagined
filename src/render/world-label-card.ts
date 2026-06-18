/**
 * Shared world-space label card (dark panel + cyan text) for nameplates and key hints.
 * Used by Pixi entity labels.
 */
import { Graphics, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { getUIFont } from "./ui-font.js";

export const WORLD_LABEL_PAD_X = 6;
export const WORLD_LABEL_PAD_Y = 3.5;
export const WORLD_LABEL_RADIUS = 3.5;
export const WORLD_LABEL_FILL = "#88c8ff";
export const WORLD_LABEL_BORDER = 0x3c78c8;

let _worldLabelStyle: TextStyle | null = null;

export function getWorldLabelTextStyle(): TextStyle {
  if (!_worldLabelStyle) {
    _worldLabelStyle = new TextStyle({
      fontFamily: getUIFont(),
      fontSize: 11,
      fontWeight: "bold",
      fill: WORLD_LABEL_FILL,
      align: "center",
      stroke: { color: "#000000", width: 2 },
    });
  }
  return _worldLabelStyle;
}

export function refreshWorldLabelTextStyle(): void {
  const style = getWorldLabelTextStyle();
  style.fontFamily = getUIFont();
  style.fontSize = 11 * (Client.settings?.fontScale ?? 1.2);
}

/** Title-case label text; bracketed key hints (e.g. [F]) stay uppercase. */
export function formatWorldLabelText(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^\[[^\]]+\]$/i.test(token)) return token.toUpperCase();
      const lower = token.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Draw a centered label card behind Pixi text (text anchor must be 0.5, 0.5). */
export function layoutWorldLabelCard(bg: Graphics, text: Text): void {
  const cardW = text.width + WORLD_LABEL_PAD_X * 2;
  const cardH = text.height + WORLD_LABEL_PAD_Y * 2;
  bg.clear();
  bg
    .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, WORLD_LABEL_RADIUS)
    .fill({ color: 0x000000, alpha: 0.55 })
    .stroke({ color: WORLD_LABEL_BORDER, width: 1.0, alpha: 0.7 });
}
