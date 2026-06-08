import type { Language } from "./index.js";

export const contractsStrings: Record<Language, Record<string, string>> = {
  en: {
    "contracts.accept": "Accept",
    "contracts.full": "Full",
    "contracts.accepted": "Accepted",
    "contracts.claim": "Claim {amount} CR",
    "contracts.returnStation": "Return to issuing station",
    "contracts.abandon": "Abandon",
    "contracts.active": "Active Contracts",
    "contracts.available": "Available",
    "contracts.noActive": "No active contracts.",
    "contracts.noAvailable": "No contracts available.",
  },
  es: {
    "contracts.accept": "Aceptar",
    "contracts.full": "Completo",
    "contracts.accepted": "Aceptado",
    "contracts.claim": "Reclamar {amount} CR",
    "contracts.returnStation": "Regresar a la estación emisora",
    "contracts.abandon": "Abandonar",
    "contracts.active": "Contratos Activos",
    "contracts.available": "Disponibles",
    "contracts.noActive": "No hay contratos activos.",
    "contracts.noAvailable": "No hay contratos disponibles.",
  },
};
