import type { Player } from "../state.js";

export function displayShipAngle(angle: number, vx: number, vy: number): number {
  const lateralVelocity = vx * Math.sin(angle) - vy * Math.cos(angle);
  const bankTilt = Math.max(-0.13, Math.min(0.13, lateralVelocity * 0.0045));
  return angle + (Math.abs(bankTilt) > 0.002 ? bankTilt : 0);
}

export function displayPlayerAngle(player: Pick<Player, "angle" | "vx" | "vy">): number {
  return displayShipAngle(player.angle, player.vx, player.vy);
}
