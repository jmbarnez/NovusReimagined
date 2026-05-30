import type { Player } from "../state.js";

// In-memory data store mimicking a database.
// Allows saving and retrieving player profiles and world states.
// Easily replaceable with a SQLite or file-based database.
class Database {
  private players = new Map<string, string>(); // name -> character JSON
  private worldState = new Map<string, string>(); // key -> data JSON

  constructor() {}

  public async savePlayer(name: string, character: Player): Promise<void> {
    this.players.set(name, JSON.stringify(character));
  }

  public async loadPlayer(name: string): Promise<Player | null> {
    const raw = this.players.get(name);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  public async saveWorldState(key: string, data: unknown): Promise<void> {
    this.worldState.set(key, JSON.stringify(data));
  }

  public async loadWorldState(key: string): Promise<unknown | null> {
    const raw = this.worldState.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  public serialize(): string {
    return JSON.stringify({
      players: Array.from(this.players.entries()),
      worldState: Array.from(this.worldState.entries()),
    });
  }

  public deserialize(rawJson: string) {
    try {
      const parsed = JSON.parse(rawJson);
      this.players = new Map(parsed.players || []);
      this.worldState = new Map(parsed.worldState || []);
    } catch (e) {
      console.error("[DB] Failed to deserialize database state", e);
    }
  }
}

export const db = new Database();
