import { TextStyle } from "pixi.js";
import { Client } from "../../state.js";
import { getUIFont } from "../ui-font.js";

// Shared styles are mutated in place so live Pixi Text objects pick up font changes.
export const _nameStyle = new TextStyle({ fontFamily: getUIFont(), fontSize: 9, fill: "#cc7777" });
export const _levelStyle = new TextStyle({ fontFamily: getUIFont(), fontSize: 9, fontWeight: "bold", fill: "#000000" });
export const _speechStyle = new TextStyle({
  fontFamily: getUIFont(),
  fontSize: 10,
  fill: "#ffffff",
  stroke: { color: "#000000", width: 2 },
  align: "center",
  wordWrap: true,
  wordWrapWidth: 180,
});

/** Re-apply the active UI font to all live enemy name/level labels. */
export function refreshEntityFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.2;
  _nameStyle.fontFamily = font;
  _nameStyle.fontSize = 9 * scale;
  _levelStyle.fontFamily = font;
  _levelStyle.fontSize = 9 * scale;
  _speechStyle.fontFamily = font;
  _speechStyle.fontSize = 10 * scale;
}
