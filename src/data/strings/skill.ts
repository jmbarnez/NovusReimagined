import type { Language } from "./index.js";

export const skillStrings: Record<Language, Record<string, string>> = {
  en: {
    "skill.hoverHint": "Hover a skill to see details.",
    "skill.xp": "XP:",
    "skill.max": "MAX",
    "skill.level": "Level:",
    "skill.maxReached": "Maximum level reached!",
    "skill.progress": "{pct}% to level {next}",
    "skill.totalLevel": "Total Level: {current} / {max}",
  },
  es: {
    "skill.hoverHint": "Pase el cursor sobre una habilidad para ver detalles.",
    "skill.xp": "EXP:",
    "skill.max": "MÁX",
    "skill.level": "Nivel:",
    "skill.maxReached": "¡Nivel máximo alcanzado!",
    "skill.progress": "{pct}% para nivel {next}",
    "skill.totalLevel": "Nivel Total: {current} / {max}",
  },
};
