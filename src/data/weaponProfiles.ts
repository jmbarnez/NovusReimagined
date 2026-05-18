export type WeaponDelivery = "projectile" | "beam" | "missile";

export interface WeaponProfile {
  rate: number;
  range: number;
  dmg: number;
  color: string;
  type: WeaponDelivery;
  spd: number;
  sz: number;
  ec: number;
  trail: string;
  ammoType: "hybrid" | "missile";
  ammoPerShot: number;
}

export const WEAPON_PROFILES: Record<string, WeaponProfile> = {
  "tu-cannon": { rate: 2.5, range: 450, dmg: 8, color: "#ffaa44", type: "projectile", spd: 380, sz: 5, ec: 2, trail: "#cc8833", ammoType: "hybrid", ammoPerShot: 1 },
  "tu-neutron": { rate: 1.5, range: 350, dmg: 11, color: "#44ff88", type: "projectile", spd: 480, sz: 3, ec: 4, trail: "#228844", ammoType: "hybrid", ammoPerShot: 1 },
  "tu-ion": { rate: 0.30, range: 600, dmg: 18, color: "#44ccff", type: "beam", spd: 0, sz: 2, ec: 7, trail: "#1188bb", ammoType: "hybrid", ammoPerShot: 1 },
  "tu-gauss": { rate: 0.60, range: 900, dmg: 34, color: "#ffdd44", type: "projectile", spd: 150, sz: 5.5, ec: 10, trail: "#aa8811", ammoType: "hybrid", ammoPerShot: 2 },
  "tu-pulse": { rate: 0.24, range: 420, dmg: 14, color: "#cc88ff", type: "beam", spd: 0, sz: 2, ec: 6, trail: "#8844bb", ammoType: "hybrid", ammoPerShot: 1 },
  "tu-missile": { rate: 0.82, range: 550, dmg: 32, color: "#ff9944", type: "projectile", spd: 140, sz: 4.5, ec: 14, trail: "#aa5522", ammoType: "missile", ammoPerShot: 1 },
  default: { rate: 0.35, range: 255, dmg: 7, color: "#88aaff", type: "projectile", spd: 220, sz: 2.5, ec: 3, trail: "#4466aa", ammoType: "hybrid", ammoPerShot: 1 },
};
