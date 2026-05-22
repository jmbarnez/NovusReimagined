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
      x: 1800, y: 2000, radius: 250,
      enemies: [{ type: "rat_drone", count: 2, level: 2 }],
      name: "Debris Field",
    },
    {
      x: -2200, y: 1400, radius: 300,
      enemies: [
        { type: "rat_drone", count: 1, level: 2 },
        { type: "rat", count: 2, level: 1 },
      ],
      name: "Rat Nest",
    },
    {
      x: 1200, y: -2400, radius: 280,
      enemies: [
        { type: "drone", count: 1, level: 2 },
        { type: "rat_drone", count: 1, level: 2 },
      ],
      name: "Drone Relay",
    },
    {
      x: -2400, y: -1200, radius: 350,
      enemies: [
        { type: "rat", count: 3, level: 1 },
        { type: "rat_drone", count: 1, level: 2 },
      ],
      name: "Scrap Gully",
    },
    {
      x: 800, y: 2600, radius: 260,
      enemies: [
        { type: "rat", count: 2, level: 1 },
        { type: "drone", count: 1, level: 2 },
      ],
      name: "Mite Patrol",
    },
  ],
};
