import type { Language } from "./index.js";

export const combatStrings: Record<Language, Record<string, string>> = {
  en: {
    "combat.destroyed": "Destroyed {name} — +{xp} XP · ~{credits} CR loot",
    "combat.destroyedAmbient": "Destroyed ambient ship: {name}",
    "combat.ambientDestroyed": "Ambient ship destroyed: {name}",
    "combat.turretKill": "Turret Kill",
    "combat.destroyedTargetDummy": "Destroyed {name}",
    "combat.noAmmo": "NO AMMO",
    "combat.noAmmoLog": "Weapon failed: ammunition depleted",
    "combat.notInArc": "NOT IN ARC",
    "combat.moduleOffline": "MODULE OFFLINE",
    "combat.moduleOfflineLog": "{name} OFFLINE — critically damaged",
    "combat.moduleHit": "MODULE HIT",
    "combat.turretOffline": "TURRET OFFLINE",
    "combat.abilityFired": "{name}",
    "combat.abilityCooldown": "COOLDOWN",
    "combat.abilityNoCap": "NO CAP",

    "combat.xpGain": "+{xp} XP",
  },
  es: {
    "combat.destroyed": "Destruido {name} — +{xp} XP · ~{credits} CR botín",
    "combat.destroyedAmbient": "Nave ambiental destruida: {name}",
    "combat.ambientDestroyed": "Nave ambiental destruida: {name}",
    "combat.turretKill": "Eliminación por Torreta",
    "combat.destroyedTargetDummy": "Destruido {name}",
    "combat.noAmmo": "SIN MUNICIÓN",
    "combat.noAmmoLog": "Arma falló: munición agotada",
    "combat.notInArc": "FUERA DE ARCO",
    "combat.moduleOffline": "MÓDULO FUERA DE LÍNEA",
    "combat.moduleOfflineLog": "{name} FUERA DE LÍNEA — daño crítico",
    "combat.moduleHit": "MÓDULO IMPACTADO",
    "combat.turretOffline": "TORRETA FUERA DE LÍNEA",
    "combat.abilityFired": "{name}",
    "combat.abilityCooldown": "EN ENFRIAMIENTO",
    "combat.abilityNoCap": "SIN CAPACITOR",

    "combat.xpGain": "+{xp} XP",
  },
};
