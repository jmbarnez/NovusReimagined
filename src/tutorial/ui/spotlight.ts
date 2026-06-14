import {
  createElement,
  append,
  setHtml,
  setCssText,
  toggleClass,
  getBounds,
  getElement,
  query,
  setStyle,
} from "../../ui/dom-helpers.js";

const HIGHLIGHT_CLASS = "tutorial-hangar-highlight";

// ── Highlight class toggling ───────────────────────────────────────────────

let _activeHighlightEl: Element | null = null;
let _activeHudHighlightEl: Element | null = null;

export function setActiveHighlight(target: Element | null): boolean {
  if (_activeHighlightEl === target) return false;
  if (_activeHighlightEl) _activeHighlightEl.classList.remove(HIGHLIGHT_CLASS);
  _activeHighlightEl = target;
  if (_activeHighlightEl) _activeHighlightEl.classList.add(HIGHLIGHT_CLASS);
  return true;
}

function clearActiveHighlight(): void {
  setActiveHighlight(null);
}

export function setHudHighlight(target: Element | null): void {
  if (_activeHudHighlightEl === target) return;
  if (_activeHudHighlightEl) toggleClass(_activeHudHighlightEl, "hud-highlight", false);
  _activeHudHighlightEl = target;
  if (_activeHudHighlightEl) toggleClass(_activeHudHighlightEl, "hud-highlight", true);
}

export function clearHudHighlight(): void {
  setHudHighlight(null);
}

function getActiveTutorialHighlight(): HTMLElement | null {
  return query(".tutorial-hangar-highlight, .hud-highlight");
}

export function getCardAnchorHighlight(): HTMLElement | null {
  return getActiveTutorialHighlight();
}

// ── Dimmer cutout segments ───────────────────────────────────────────────────

let _lastStationCutoutKey = "";

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

// ── HUD dimmer visibility ────────────────────────────────────────────────────

let _hudDimmerEl: HTMLElement | null = null;
let _hudDimmerVisible = false;
let _hudDimmerHideTimer: number | null = null;
let _lastDimmerCutoutKey = "";

export function syncHudDimmerVisibility(target: HTMLElement | null, show: boolean): void {
  let dimmer = _hudDimmerEl;

  if (show) {
    if (!dimmer) {
      const hudOverlay = getElement("hud-overlay");
      if (!hudOverlay) return;
      dimmer = createElement("div", "hidden");
      dimmer.id = "hud-tour-dimmer";
      ensureDimmerSegments(dimmer);
      append(hudOverlay, dimmer);
      _hudDimmerEl = dimmer;
    }
    if (_hudDimmerHideTimer != null) {
      window.clearTimeout(_hudDimmerHideTimer);
      _hudDimmerHideTimer = null;
    }
    toggleClass(dimmer, "hidden", false);
    setStyle(dimmer, { display: "block" });
    const bounds = getBounds(dimmer);
    const cutoutKey = target ? `${target.id}|${target.className}|${bounds.width}|${bounds.height}` : "none";
    if (_lastDimmerCutoutKey !== cutoutKey) {
      _lastDimmerCutoutKey = cutoutKey;
      syncDimmerCutout(dimmer, target, bounds);
    }
    _hudDimmerVisible = true;
  } else if (dimmer && _hudDimmerVisible) {
    toggleClass(dimmer, "hidden", true);
    _hudDimmerVisible = false;
    _lastDimmerCutoutKey = "";
    _hudDimmerHideTimer = window.setTimeout(() => {
      if (dimmer && dimmer.classList.contains("hidden")) {
        setStyle(dimmer, { display: "none" });
      }
      _hudDimmerHideTimer = null;
    }, 250);
  }
}

export function clearHudDimmer(): void {
  syncHudDimmerVisibility(null, false);
}
