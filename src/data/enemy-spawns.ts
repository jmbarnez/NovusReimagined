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
      x: 800, y: 1200, radius: 80,
      enemies: [{ type: "rat_drone", count: 2, level: 2 }],
      name: "Debris Field",
    },
    {
      x: -1200, y: 800, radius: 100,
      enemies: [
        { type: "rat_drone", count: 1, level: 2 },
        { type: "rat", count: 2, level: 1 },
      ],
      name: "Rat Nest",
    },
    {
      x: 400, y: -1600, radius: 90,
      enemies: [
        { type: "drone", count: 1, level: 2 },
        { type: "rat_drone", count: 1, level: 2 },
      ],
      name: "Drone Relay",
    },
    {
      x: -1600, y: -500, radius: 130,
      enemies: [
        { type: "rat", count: 3, level: 1 },
        { type: "rat_drone", count: 1, level: 2 },
      ],
      name: "Scrap Gully",
    },
    {
      x: 500, y: 1800, radius: 100,
      enemies: [
        { type: "rat", count: 2, level: 1 },
        { type: "drone", count: 1, level: 2 },
      ],
      name: "Mite Patrol",
    },
  ],
};
