/** Selectable aim-reticle styles. Drawn in world space by drawCrosshair(). */
export interface ReticleOption {
  id: string;
  label: string;
}

export const RETICLE_OPTIONS: ReticleOption[] = [
  { id: "classic", label: "Cross + Circle" },
  { id: "cross", label: "Crosshair" },
  { id: "brackets", label: "Brackets" },
  { id: "dot", label: "Precision Dot" },
  { id: "diamond", label: "Diamond Lock" },
  { id: "chevrons", label: "Chevron Inward" },
  { id: "delta", label: "Tactical Delta" },
  { id: "ring", label: "Ring Notch" },
  { id: "hex", label: "Hex Lock" },
  { id: "radar", label: "Radar Sweep" },
];
