import { getState } from "../../state-access.js";
import { closeStationUi } from "../../docking/index.js";
import { sfxBlip, sfxConfirm, sfxError } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { stationState } from "./shared.js";
import { renderMarket } from "./market.js";
import { getElement } from "../dom-helpers.js";

export type StationActionHandler = (btn: HTMLElement) => void;

function getRackAndIndex(btn: HTMLElement): { rack: "turret" | "high" | "med" | "low"; idx: number } {
  return {
    rack: btn.dataset.rack as "turret" | "high" | "med" | "low",
    idx: parseInt(btn.dataset.idx || "0", 10),
  };
}

export const stationActionHandlers: Record<string, StationActionHandler> = {
  undock: () => {
    sfxBlip();
    queueFrameAction({ type: "undock" });
    closeStationUi();
  },
  repair: () => {
    queueFrameAction({ type: "repairShip" });
    sfxConfirm();
  },
  buyMod: (btn) => {
    const id = btn.dataset.modId;
    if (!id) return;
    queueFrameAction({ type: "buyModule", payload: { moduleId: id } });
    sfxConfirm();
  },
  sellMod: (btn) => {
    const id = btn.dataset.modId;
    if (!id) return;
    queueFrameAction({ type: "sellModule", payload: { moduleId: id } });
    sfxConfirm();
  },
  buyHybrid: () => {
    if (getState().player.credits < 40) { sfxError(); return; }
    queueFrameAction({ type: "buyAmmunition", payload: { ammoType: "hybrid" } });
    sfxConfirm();
  },
  buyMissile: () => {
    if (getState().player.credits < 95) { sfxError(); return; }
    queueFrameAction({ type: "buyAmmunition", payload: { ammoType: "missile" } });
    sfxConfirm();
  },
  sellOre: (btn) => {
    const key = btn.dataset.ore;
    if (!key) return;
    if ((getState().player.ore[key] || 0) <= 0) { sfxError(); return; }
    queueFrameAction({ type: "sellCargoResource", payload: { category: "ore", key } });
    sfxConfirm();
  },
  sellLoot: (btn) => {
    const key = btn.dataset.loot;
    if (!key) return;
    if ((getState().player.loot[key] || 0) <= 0) { sfxError(); return; }
    queueFrameAction({ type: "sellCargoResource", payload: { category: "loot", key } });
    sfxConfirm();
  },
  sellComp: (btn) => {
    const key = btn.dataset.comp;
    if (!key) return;
    if ((getState().player.components[key] || 0) <= 0) { sfxError(); return; }
    queueFrameAction({ type: "sellCargoResource", payload: { category: "components", key } });
    sfxConfirm();
  },
  fit: (btn) => {
    const { rack, idx } = getRackAndIndex(btn);
    const select = btn.parentElement?.querySelector("select");
    const instanceId = select ? (select as HTMLSelectElement).value : "";
    if (!instanceId) { sfxError(); return; }
    queueFrameAction({ type: "fitModule", payload: { rack, slotIdx: idx, instanceId } });
    sfxConfirm();
  },
  unfit: (btn) => {
    const { rack, idx } = getRackAndIndex(btn);
    queueFrameAction({ type: "unfitModule", payload: { rack, slotIdx: idx } });
    sfxConfirm();
  },
  setHome: () => {
    queueFrameAction({ type: "setHomeSystem" });
    sfxConfirm();
  },
  mktTab: (btn) => {
    stationState.mktTab = btn.dataset.tab || "modules";
    sfxBlip(640, 0.04);
    renderMarket();
  },
  mktRack: (btn) => {
    stationState.mktRack = btn.dataset.rack || "all";
    sfxBlip(640, 0.04);
    renderMarket();
  },
  swapMod: (btn) => {
    const { rack, idx } = getRackAndIndex(btn);
    const select = getElement(`swap-${rack}-${idx}`) as HTMLSelectElement | null;
    const newUid = select?.value ?? "";
    if (!newUid) { sfxError(); return; }
    queueFrameAction({ type: "swapModule", payload: { rack, slotIdx: idx, instanceId: newUid } });
    sfxConfirm();
  },
  acceptContract: (btn) => {
    const id = btn.dataset.contractId;
    if (!id) return;
    queueFrameAction({ type: "acceptContract", payload: { contractId: id } });
    sfxConfirm();
  },
  turnInContract: (btn) => {
    const id = btn.dataset.contractId;
    if (!id) return;
    queueFrameAction({ type: "turnInContract", payload: { contractId: id } });
    sfxConfirm();
  },
  abandonContract: (btn) => {
    const id = btn.dataset.contractId;
    if (!id) return;
    queueFrameAction({ type: "abandonContract", payload: { contractId: id } });
    sfxBlip();
  },
};
