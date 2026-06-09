const HIGHLIGHT_CLASS = "tutorial-hangar-highlight";

let _activeHighlightEl: Element | null = null;
let _lastCutoutKey = "";

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

export function syncStationDimmerCutout(target: HTMLElement | null): void {
  const dimmer = document.getElementById("st-dimmer");
  if (!dimmer) return;
  const nextKey = target ? `${target.id}|${target.className}` : "none";
  if (_lastCutoutKey === nextKey) return;
  _lastCutoutKey = nextKey;
  const segments = ensureDimmerSegments(dimmer);
  const stationRect = dimmer.getBoundingClientRect();
  if (!target) {
    segments[0].style.cssText = "left:0;top:0;width:100%;height:100%;";
    for (let i = 1; i < segments.length; i++) segments[i].style.cssText = "display:none;";
    return;
  }

  const pad = 8;
  const rect = target.getBoundingClientRect();
  const left = Math.max(0, rect.left - stationRect.left - pad);
  const top = Math.max(0, rect.top - stationRect.top - pad);
  const right = Math.min(stationRect.width, rect.right - stationRect.left + pad);
  const bottom = Math.min(stationRect.height, rect.bottom - stationRect.top + pad);

  segments[0].style.cssText = `display:block;left:0;top:0;width:100%;height:${top}px;`;
  segments[1].style.cssText = `display:block;left:0;top:${bottom}px;width:100%;height:${Math.max(0, stationRect.height - bottom)}px;`;
  segments[2].style.cssText = `display:block;left:0;top:${top}px;width:${left}px;height:${Math.max(0, bottom - top)}px;`;
  segments[3].style.cssText = `display:block;left:${right}px;top:${top}px;width:${Math.max(0, stationRect.width - right)}px;height:${Math.max(0, bottom - top)}px;`;
}

export function resetStationDimmer(): void {
  _lastCutoutKey = "";
  const dimmer = document.getElementById("st-dimmer");
  if (!dimmer) return;
  dimmer.classList.remove("active");
  for (const segment of ensureDimmerSegments(dimmer)) {
    segment.removeAttribute("style");
  }
}

function ensureDimmerSegments(dimmer: HTMLElement): HTMLElement[] {
  const existing = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
  if (existing.length === 4) return existing;
  dimmer.innerHTML = "";
  const segments: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = document.createElement("div");
    segment.className = "tutorial-dimmer-segment";
    dimmer.appendChild(segment);
    segments.push(segment);
  }
  return segments;
}
