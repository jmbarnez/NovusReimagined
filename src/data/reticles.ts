/** Selectable aim-reticle styles. Drawn in world space by drawCrosshair(). */
export interface ReticleOption {
  id: string;
  label: string;
}

export const RETICLE_OPTIONS: ReticleOption[] = [
  { id: "classic", label: "Cross + Circle" },
  { id: "cross", label: "Crosshair" },
  { id: "brackets", label: "Brackets" },
];
