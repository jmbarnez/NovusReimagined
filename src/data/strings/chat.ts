import type { Language } from "./index.js";

export const chatStrings: Record<Language, Record<string, string>> = {
  en: {
    "chat.system": "SYSTEM",
    "chat.welcome": "Neural channel open. Press T to transmit.",
  },
  es: {
    "chat.system": "SISTEMA",
    "chat.welcome": "Canal neural abierto. Presione T para transmitir.",
  },
};
