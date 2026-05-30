import { DamageProfile } from "../../../data/modules.js";
import { t } from "../../../utils/i18n.js";

/** Maps weapon delivery type to translated label */
export function weaponDeliveryLabel(m: { weaponDelivery?: string }): string {
  if (!m.weaponDelivery) return "—";
  const deliveryKeys: Record<string, string> = {
    projectile: "ship.projectile",
    beam: "ship.energyBeam",
    missile: "ship.guidedMissile",
  };
  const key = deliveryKeys[m.weaponDelivery];
  return key ? t(key) : m.weaponDelivery;
}

/** Formats module damage profiles in local context */
export function damageTypeLabel(profile?: DamageProfile | null): string {
  if (!profile) return "";
  const labels: Record<string, string> = { em: "EM", therm: "Thermal", kin: "Kinetic", exp: "Explosive" };
  return Object.entries(profile)
    .filter(([, v]) => v)
    .map(([t, v]) => `${v} ${labels[t] || t}`)
    .join(" / ");
}
