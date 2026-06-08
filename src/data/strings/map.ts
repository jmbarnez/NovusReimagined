import type { Language } from "./index.js";

export const mapStrings: Record<Language, Record<string, string>> = {
  en: {
    "map.survey.power": "PWR",
    "map.survey.strength": "STR",
    "map.survey.scan": "Scan",
    "map.survey.off": "Scanner off",
    "map.survey.waypointSector": "Waypoint must stay in your current sector.",
    "map.survey.directMode": "Map waypoints are disabled while Direct Piloting is selected in Controls.",
    "map.survey.powerOn": "Power a Survey Scanner turret ON to run the map array.",
  },
  es: {
    "map.survey.power": "ENERGÍA",
    "map.survey.strength": "POTENCIA",
    "map.survey.scan": "Escanear",
    "map.survey.off": "Escáner apagado",
    "map.survey.waypointSector": "El punto de ruta debe permanecer en su sector actual.",
    "map.survey.directMode": "Los puntos de ruta del mapa están desactivados mientras Pilotaje Directo está seleccionado en Controles.",
    "map.survey.powerOn": "Encienda un turret de Escáner de Prospección para ejecutar la matriz de mapa.",
  },
};
