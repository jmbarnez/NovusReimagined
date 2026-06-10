import type { Language } from "./index.js";

export const stationStrings: Record<Language, Record<string, string>> = {
  en: {
    "station.hangar": "Hangar",
    "station.market": "Market",
    "station.industry": "Refining",
    "station.fabrication": "Fabrication",
    "station.contracts": "Contracts",
    "station.undock": "⏏ Undock",
    "station.highSec": "HIGH SEC",
    "station.midSec": "MID SEC",
    "station.lowSec": "LOW SEC",
    "station.services": "Services",
  },
  es: {
    "station.hangar": "Hangar",
    "station.market": "Mercado",
    "station.industry": "Refinado",
    "station.fabrication": "Fabricación",
    "station.contracts": "Contratos",
    "station.undock": "⏏ Desacoplar",
    "station.highSec": "ALTA SEC",
    "station.midSec": "MEDIA SEC",
    "station.lowSec": "BAJA SEC",
    "station.services": "Servicios",
  },
};
