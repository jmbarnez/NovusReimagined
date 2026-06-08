import type { Language } from "./index.js";

export const pilotStrings: Record<Language, Record<string, string>> = {
  en: {
    "pilot.title": "PILOT REGISTRY",
    "pilot.subtitle": "CALLSIGN ASSIGNMENT",
    "pilot.callsign": "CALLSIGN",
    "pilot.callsignPlaceholder": "Enter callsign...",
    "pilot.hullClass": "HULL CLASS",
    "pilot.establish": "ESTABLISH CALLSIGN",
    "pilot.back": "BACK",
    "pilot.awaiting": "AWAITING PILOT IDENTIFICATION",
    "pilot.registryOnline": "Pilot registry terminal online.",
    "pilot.assignCallsign": "Assign a callsign for neural link broadcast.",
    "pilot.invalidCallsign": "Invalid callsign",
  },
  es: {
    "pilot.title": "REGISTRO DE PILOTO",
    "pilot.subtitle": "ASIGNACIÓN DE SEÑAL",
    "pilot.callsign": "SEÑAL",
    "pilot.callsignPlaceholder": "Ingrese su señal...",
    "pilot.hullClass": "CLASE DE CASCO",
    "pilot.establish": "ESTABLECER SEÑAL",
    "pilot.back": "ATRÁS",
    "pilot.awaiting": "ESPERANDO IDENTIFICACIÓN DE PILOTO",
    "pilot.registryOnline": "Terminal de registro de piloto en línea.",
    "pilot.assignCallsign": "Asigne una señal para transmisión de enlace neural.",
    "pilot.invalidCallsign": "Señal inválida",
  },
};
