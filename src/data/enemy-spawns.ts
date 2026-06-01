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
      enemies: [{ type: "target_dummy", count: 3, level: 1 }],
      name: "Target Range",
      respawnSeconds: 15,
    },
  ],
};
