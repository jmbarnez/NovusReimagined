import type { Language } from "./index.js";

export const multiplayerStrings: Record<Language, Record<string, string>> = {
  en: {
    "multiplayer.subtitle": "REMOTE NEURAL RELAY",
    "multiplayer.find": "FIND & JOIN",
    "multiplayer.find.kicker": "Scan",
    "multiplayer.find.body": "Search the local network for active relay broadcasts.",
    "multiplayer.join": "JOIN BY ADDRESS",
    "multiplayer.join.kicker": "Manual",
    "multiplayer.join.body": "Connect directly to a known host using IP and port.",
  },
  es: {
    "multiplayer.subtitle": "RELE NEURAL REMOTO",
    "multiplayer.find": "BUSCAR Y UNIRSE",
    "multiplayer.find.kicker": "Escaneo",
    "multiplayer.find.body": "Busca emisiones de reles activos en la red local.",
    "multiplayer.join": "UNIRSE POR DIRECCIÓN",
    "multiplayer.join.kicker": "Manual",
    "multiplayer.join.body": "Conecta directamente a un host conocido con IP y puerto.",
  },
};
