export interface SpawnZone {
  x: number;
  y: number;
  radius: number;
  enemies: { type: string; count: number; level: number }[];
  name?: string;
  respawnSeconds?: number;
}

export const ENEMY_SPAWNS: Record<string, SpawnZone[]> = {
  "sys-0": [
    {
      x: 2200, y: 1600, radius: 160,
      enemies: [{ type: "drone", count: 3, level: 1 }],
      name: "Gunnery Range",
      respawnSeconds: 15,
    },
    {
      x: 2000, y: 2900, radius: 240,
      enemies: [
        { type: "rat", count: 2, level: 1 },
        { type: "rat_drone", count: 1, level: 2 },
      ],
      name: "Signal Trace",
      respawnSeconds: 30,
    },
  ],
};
