export const CRITICAL_GLITCH_CHANCE = 0.22;
export const CRITICAL_GLITCH_MAX_OFFSET = 2.5;
export const HUD_CRITICAL_COLOR = 0xee4444;
export const HUD_BOOST_COLOR = 0x7fffff;

export function themeColor(hex: string): number {
  return parseInt(hex.replace("#", "0x"), 16);
}
