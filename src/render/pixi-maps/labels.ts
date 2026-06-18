import { Text, TextStyle } from "pixi.js";
import { Client } from "../../state.js";
import { getUIFont } from "../ui-font.js";
import { pixiMapState } from "./state.js";
import type { LabelStyleKind } from "./utils.js";

function createNameStyle(): TextStyle {
  const scale = Client.settings?.fontScale ?? 1.2;
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 9 * scale, fill: "#ffffff", align: "center" });
}
function createSmallStyle(): TextStyle {
  const scale = Client.settings?.fontScale ?? 1.2;
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 8 * scale, fill: "#6688aa", align: "center" });
}
function createBoldStyle(): TextStyle {
  const scale = Client.settings?.fontScale ?? 1.2;
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 10 * scale, fontWeight: "bold", fill: "#ffffff", align: "center" });
}

export function getLabelStyle(kind: LabelStyleKind): TextStyle {
  const scale = Client.settings?.fontScale ?? 1.2;
  const font = getUIFont();
  const key = `${font}|${scale.toFixed(3)}`;
  if (pixiMapState._lastLabelFontKey !== key) {
    pixiMapState._lastLabelFontKey = key;
    pixiMapState._nameStyle = null;
    pixiMapState._smallStyle = null;
    pixiMapState._boldStyle = null;
    pixiMapState._labelStyleVariantCache.clear();
  }

  if (kind === "name") {
    if (!pixiMapState._nameStyle) pixiMapState._nameStyle = createNameStyle();
    return pixiMapState._nameStyle;
  }
  if (kind === "small") {
    if (!pixiMapState._smallStyle) pixiMapState._smallStyle = createSmallStyle();
    return pixiMapState._smallStyle;
  }
  if (!pixiMapState._boldStyle) pixiMapState._boldStyle = createBoldStyle();
  return pixiMapState._boldStyle;
}

export function getLabelStyleWithFill(kind: LabelStyleKind, fill: number): TextStyle {
  const key = `${kind}|${fill}`;
  const hit = pixiMapState._labelStyleVariantCache.get(key);
  if (hit) return hit;
  const base = getLabelStyle(kind);
  const style = new TextStyle({
    fontFamily: base.fontFamily,
    fontSize: base.fontSize,
    fontWeight: base.fontWeight,
    align: base.align,
    fill,
  });
  pixiMapState._labelStyleVariantCache.set(key, style);
  return style;
}

export function beginLabelFrame(): void {
  pixiMapState._activeMapLabelKeys.clear();
}

export function setMapLabel(
  key: string,
  value: string,
  styleKind: LabelStyleKind,
  x: number,
  y: number,
  alpha: number,
  fill?: number,
): void {
  if (!pixiMapState.labelContainer) return;
  pixiMapState._activeMapLabelKeys.add(key);

  let label = pixiMapState._mapLabelPool.get(key);
  if (!label) {
    const style = fill !== undefined ? getLabelStyleWithFill(styleKind, fill) : getLabelStyle(styleKind);
    label = new Text({ text: value, style });
    label.anchor.set(0.5, 0.5);
    pixiMapState.labelContainer.addChild(label);
    pixiMapState._mapLabelPool.set(key, label);
  }

  if (label.text !== value) label.text = value;
  const style = fill !== undefined ? getLabelStyleWithFill(styleKind, fill) : getLabelStyle(styleKind);
  if (label.style !== style) label.style = style;
  label.position.set(Math.round(x), Math.round(y));
  label.alpha = alpha;
  label.visible = true;
}

export function endLabelFrame(): void {
  for (const [key, label] of pixiMapState._mapLabelPool) {
    if (pixiMapState._activeMapLabelKeys.has(key)) continue;
    label.visible = false;
  }
}
