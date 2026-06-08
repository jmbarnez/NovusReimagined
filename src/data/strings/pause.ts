import type { Language } from "./index.js";

export const pauseStrings: Record<Language, Record<string, string>> = {
  en: {
    "pause.title": "PAUSED",
    "pause.resume": "RESUME",
    "pause.save": "SAVE",
    "pause.load": "LOAD",
    "pause.settings": "SETTINGS",
    "pause.exit": "EXIT TO MAIN MENU",
    "pause.confirmLoad": "Load last saved game? Unsaved progress since the last save will be lost.",
    "pause.noSave": "No save data found.",
    "pause.confirmExit": "Return to the main menu? Unsaved progress since your last save will be lost.",
    "pause.saveLoaded": "Save loaded. System entry: {sys} (SEC {sec})",
  },
  es: {
    "pause.title": "PAUSA",
    "pause.resume": "REANUDAR",
    "pause.save": "GUARDAR",
    "pause.load": "CARGAR",
    "pause.settings": "CONFIGURACIÓN",
    "pause.exit": "SALIR AL MENÚ",
    "pause.confirmLoad": "¿Cargar la última partida guardada? El progreso no guardado desde el último guardado se perderá.",
    "pause.noSave": "No se encontraron datos guardados.",
    "pause.confirmExit": "¿Volver al menú principal? El progreso no guardado desde su último guardado se perderá.",
    "pause.saveLoaded": "Partida cargada. Entrada al sistema: {sys} (SEC {sec})",
  },
};
