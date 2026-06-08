import type { Language } from "./index.js";

export const timeAgoStrings: Record<Language, Record<string, string>> = {
  en: {
    "timeAgo.days": "{n}d ago",
    "timeAgo.hours": "{n}h ago",
    "timeAgo.minutes": "{n}m ago",
    "timeAgo.justNow": "just now",
    "timeAgo.unknown": "unknown",
  },
  es: {
    "timeAgo.days": "hace {n}d",
    "timeAgo.hours": "hace {n}h",
    "timeAgo.minutes": "hace {n}m",
    "timeAgo.justNow": "ahora mismo",
    "timeAgo.unknown": "desconocido",
  },
};
