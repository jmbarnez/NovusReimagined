import { createElement, append, setHtml, setCssText, toggleClass, getBounds, getElement } from "../dom-helpers.js";

const HIGHLIGHT_CLASS = "tutorial-hangar-highlight";

let _activeHighlightEl: Element | null = null;
let _lastStationCutoutKey = "";

export function setActiveHighlight(target: Element | null): boolean {
  if (_activeHighlightEl === target) return false;
  if (_activeHighlightEl) {
    _activeHighlightEl.classList.remove(HIGHLIGHT_CLASS);
  }
  _activeHighlightEl = target;
  if (_activeHighlightEl) {
    _activeHighlightEl.classList.add(HIGHLIGHT_CLASS);
  }
  return true;
}

export function clearActiveHighlight(): void {
  setActiveHighlight(null);
}

export function ensureDimmerSegments(dimmer: HTMLElement): HTMLElement[] {
  const existing = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
  if (existing.length === 4) return existing;
  setHtml(dimmer, "");
  const segments: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = createElement("div", "tutorial-dimmer-segment");
    append(dimmer, segment);
    segments.push(segment);
  }
  return segments;
}

export function syncDimmerCutout(
  dimmer: HTMLElement,
  target: HTMLElement | null,
  bounds: DOMRect,
  pad = 8,
): void {
  const segments = ensureDimmerSegments(dimmer);
  if (!target) {
    setCssText(segments[0], "left:0;top:0;width:100%;height:100%;");
    for (let i = 1; i < segments.length; i++) setCssText(segments[i], "display:none;");
    return;
  }

  const rect = getBounds(target);
  const left = Math.max(0, rect.left - bounds.left - pad);
  const top = Math.max(0, rect.top - bounds.top - pad);
  const right = Math.min(bounds.width, rect.right - bounds.left + pad);
  const bottom = Math.min(bounds.height, rect.bottom - bounds.top + pad);

  setCssText(segments[0], `display:block;left:0;top:0;width:100%;height:${top}px;`);
  setCssText(segments[1], `display:block;left:0;top:${bottom}px;width:100%;height:${Math.max(0, bounds.height - bottom)}px;`);
  setCssText(segments[2], `display:block;left:0;top:${top}px;width:${left}px;height:${Math.max(0, bottom - top)}px;`);
  setCssText(segments[3], `display:block;left:${right}px;top:${top}px;width:${Math.max(0, bounds.width - right)}px;height:${Math.max(0, bottom - top)}px;`);
}

export function syncStationDimmerCutout(target: HTMLElement | null): void {
  const dimmer = getElement("st-dimmer");
  if (!dimmer) return;
  const nextKey = target ? `${target.id}|${target.className}` : "none";
  if (_lastStationCutoutKey === nextKey) return;
  _lastStationCutoutKey = nextKey;
  syncDimmerCutout(dimmer, target, getBounds(dimmer));
}

export function resetStationDimmer(): void {
  _lastStationCutoutKey = "";
  const dimmer = getElement("st-dimmer");
  if (!dimmer) return;
  toggleClass(dimmer, "active", false);
  for (const segment of ensureDimmerSegments(dimmer)) {
    segment.removeAttribute("style");
  }
}
