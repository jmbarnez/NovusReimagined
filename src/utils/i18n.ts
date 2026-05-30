import { Client } from "../state.js";
import { STRINGS } from "../data/strings.js";

export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = Client.settings?.language ?? "en";
  const map = STRINGS[lang];
  if (!map) return key;
  let str = map[key];
  if (str === undefined) return key;
  if (!vars) return str;
  for (const [k, v] of Object.entries(vars))
    str = str.replace(`{${k}}`, String(v));
  return str;
}
