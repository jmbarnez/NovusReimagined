import { Client } from "../../../state.js";
import { escHtml } from "../../../utils/format.js";
import { formatCompositionBreakdown } from "../../../utils/ore-naming.js";
import { getElement, setHtml, setStyle } from "../../dom-helpers.js";
import { ensureInvHoverTip, HOVER_TIP_ID } from "./elements.js";
import type { InventoryItem } from "../state.js";

export function showInvHoverTip(it: InventoryItem, clientX: number, clientY: number) {
  const el = ensureInvHoverTip();
  const nameColor = it.rarityColor ?? "var(--hud-text-bright)";
  const volStr = ((it.vol || 0) * it.qty).toFixed(1);
  const subLine = it.type === "mixedOre" && it.composition
    ? formatCompositionBreakdown(it.composition)
    : it.type === "material" && it.composition
      ? formatCompositionBreakdown(it.composition)
    : it.group;
  setHtml(el, `
    <div class="inv-hover-tip-name" style="color:${nameColor}">${escHtml(it.name)}</div>
    <div class="inv-hover-tip-sub">${escHtml(subLine)} · ${volStr} m³ · ${it.qty.toLocaleString()}×</div>
  `);
  const scale = Client.settings?.uiScale ?? 1.0;
  setStyle(el, { display: "block", left: `${(clientX + 12) / scale}px`, top: `${(clientY + 12) / scale}px` });

  requestAnimationFrame(() => {
    const pad = 6;
    const r = el.getBoundingClientRect();
    let left = clientX + 12;
    let top = clientY + 12;
    if (left + r.width > window.innerWidth - pad) left = Math.max(pad, clientX - r.width - 8);
    if (top + r.height > window.innerHeight - pad) top = Math.max(pad, clientY - r.height - 8);
    setStyle(el, { left: `${left / scale}px`, top: `${top / scale}px` });
  });
}

export function hideInvHoverTip() {
  const el = getElement(HOVER_TIP_ID);
  if (el) setStyle(el, { display: "none" });
}
