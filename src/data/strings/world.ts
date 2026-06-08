import type { Language } from "./index.js";

export const worldStrings: Record<Language, Record<string, string>> = {
  en: {
    "world.sector.start": "S.T.A.R.T Training Sector",
    "world.region.flightDeck": "Flight Deck",
    "world.region.miningRange": "Mining Range",
    "world.region.industryBench": "Refining Bay",
    "world.region.gunneryBay": "Target Range",
    "world.location.academy": "Academy",
    "world.location.stargate": "Stargate",
    "world.gate.flyThrough": "Fly through ring",
    "world.gate.warpKey": "[{key}] Warp",
    "world.gate.clearanceRequired": "Academy clearance required",
  },
  es: {
    "world.sector.start": "Sector de Entrenamiento S.T.A.R.T",
    "world.region.flightDeck": "Plataforma de Vuelo",
    "world.region.miningRange": "Rango de Minería",
    "world.region.industryBench": "Bahía de Refinado",
    "world.region.gunneryBay": "Campo de Blancos",
    "world.location.academy": "Academia",
    "world.location.stargate": "Puerta Estelar",
    "world.gate.flyThrough": "Vuele por el anillo",
    "world.gate.warpKey": "[{key}] Salto",
    "world.gate.clearanceRequired": "Se requiere autorizacion de la Academia",
  },
};
