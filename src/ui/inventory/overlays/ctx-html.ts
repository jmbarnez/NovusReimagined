import { getState } from "../../../state-access.js";
import { moduleFitsShipRack } from "../../../utils/hardpoints.js";
import { escHtml } from "../../../utils/format.js";
import { canModifyFitting } from "../../../utils/fitting-gate.js";
import { RACK_TYPES } from "../../../constants.js";
import { t } from "../../../utils/i18n.js";
import { normalizeItems } from "../tree.js";

export function buildContextMenuHTML(itemId: string): string {
  const all = normalizeItems();
  const it = all.find((i) => i.id === itemId);
  if (!it) return "";

  const slotsLabelKey: Record<string, string> = {
    turret: t("inventory.slotTurret"),
    high: t("inventory.slotHigh"),
    med: t("inventory.slotMed"),
    low: t("inventory.slotLow"),
  };

  const rows: { action: string; label: string; disabled?: boolean }[] = [];
  const gate = canModifyFitting();

  if (it.type === "module" && it.meta?.rack) {
    const modRack = it.meta.rack;
    const uid = it.instance?.uid ?? it.key;
    for (const shipRack of RACK_TYPES) {
      const slots = getState().player.fitting[shipRack] ?? [];
      if (slots.length === 0) continue;
      if (!moduleFitsShipRack(modRack, shipRack)) continue;
      for (let i = 0; i < slots.length; i++) {
        const slotLabel = `${slotsLabelKey[shipRack] || shipRack} ${i + 1}`;
        if (!slots[i]) {
          rows.push({ action: `fit:${shipRack}:${i}`, label: t("inventory.fitTo", { slot: slotLabel }), disabled: !gate.ok });
        } else if (slots[i] !== uid) {
          rows.push({ action: `swap:${shipRack}:${i}`, label: t("inventory.swapWith", { slot: slotLabel }), disabled: !gate.ok });
        }
      }
    }
  }

  if (it.type === "fitting") {
    const [rack, idxStr] = it.key.split(":");
    rows.push({ action: `unfit:${rack}:${idxStr}`, label: t("inventory.unfit"), disabled: !gate.ok });
  }

  if (it.type !== "fitting") {
    if (it.type === "ammo") {
      rows.push({ action: "jettison-all", label: t("inventory.jettison") });
    } else if (it.qty > 1) {
      rows.push({ action: "jettison-all", label: t("inventory.jettisonAll", { qty: it.qty.toLocaleString() }) });
      rows.push({ action: "jettison-partial", label: t("inventory.jettisonQty") });
    } else {
      rows.push({ action: "jettison-all", label: t("inventory.jettison") });
    }
  }

  rows.push({ action: "info", label: t("inventory.showInfo") });

  return `<div class="inv-ctx">
    ${rows.map((row) => {
      const cls = row.disabled ? "inv-ctx-item is-disabled" : "inv-ctx-item";
      const extra = row.disabled ? ' aria-disabled="true"' : "";
      return `<div class="${cls}" data-action="${row.action}" data-item="${itemId}"${extra}>${escHtml(row.label)}</div>`;
    }).join("")}
  </div>`;
}
