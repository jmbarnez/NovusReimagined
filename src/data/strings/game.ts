import type { Language } from "./index.js";

export const gameStrings: Record<Language, Record<string, string>> = {
  en: {
    "game.neuralLink": "Neural link initiated. System entry: {sys} (SEC {sec})",
    "game.neuralRestored": "Neural link restored. System entry: {sys} (SEC {sec})",
  },
  es: {
    "game.neuralLink": "Enlace neural iniciado. Entrada al sistema: {sys} (SEC {sec})",
    "game.neuralRestored": "Enlace neural restaurado. Entrada al sistema: {sys} (SEC {sec})",
  },
};
