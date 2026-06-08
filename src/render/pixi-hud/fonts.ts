import { Client } from "../../state.js";
import { getUIFont } from "../ui-font.js";
import { hudState } from "./state.js";

export function refreshHudFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.0;
  if (hudState.speedStyle) { hudState.speedStyle.fontFamily = font; hudState.speedStyle.fontSize = 8 * scale; }
  if (hudState.shieldStyle) { hudState.shieldStyle.fontFamily = font; hudState.shieldStyle.fontSize = 8 * scale; }
  if (hudState.warningStyle) { hudState.warningStyle.fontFamily = font; hudState.warningStyle.fontSize = 9 * scale; }
  if (hudState.targetStyle) { hudState.targetStyle.fontFamily = font; hudState.targetStyle.fontSize = 9 * scale; }
}
