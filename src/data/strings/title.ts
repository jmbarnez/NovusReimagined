import type { Language } from "./index.js";

export const titleStrings: Record<Language, Record<string, string>> = {
  en: {
    "title.game": "NOVUS",
    "title.subtitle": "NEURAL SPACE SIMULATION",
    "title.singleplayer": "PLAY",
    "title.multiplayer": "JOIN",
    "title.settings": "SETTINGS",
    "title.exit": "EXIT",
    "title.settingsLabel": "Settings",
    "title.safeExit": "SAFE EXIT",
    "title.exitConfirm": "Safely exit Novus? Any unsaved progress will be lost.",
    "title.initializing": "Initializing neural interface",
    "title.neuralPending": "Neural link pending",
  },
  es: {
    "title.game": "NOVUS",
    "title.subtitle": "SIMULACIÓN ESPACIAL NEURAL",
    "title.singleplayer": "JUGAR",
    "title.multiplayer": "UNIRSE",
    "title.settings": "CONFIGURACIÓN",
    "title.exit": "SALIR",
    "title.settingsLabel": "Configuración",
    "title.safeExit": "SALIDA SEGURA",
    "title.exitConfirm": "¿Salir de Novus de forma segura? Cualquier progreso no guardado se perderá.",
    "title.initializing": "Inicializando interfaz neural",
    "title.neuralPending": "Enlace neural pendiente",
  },
};
