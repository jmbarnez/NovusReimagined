export interface ContextFitAction {
  kind: "fit" | "swap" | "unfit";
  rack: "turret" | "high" | "med" | "low";
  slotIdx: number;
  uid: string;
}

export interface InventoryOverlayHandlers {
  onCloseContextMenu: () => void;
  onJettisonItem: (itemId: string, qty: number | null) => void;
  onShowInfoPanel: (itemId: string, anchorX?: number, anchorY?: number) => void;
  onFitAction: (action: ContextFitAction) => void;
  onRerender: () => void;
}
