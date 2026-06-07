import { describe, it, expect, beforeEach } from "vitest";
import { SpatialGrid } from "../src/utils/spatial.js";

describe("SpatialGrid incremental updates", () => {
  let grid: SpatialGrid;

  beforeEach(() => {
    grid = new SpatialGrid(128);
  });

  it("inserts an entity into the correct cells", () => {
    grid.insert("e1", 100, 100, 30);
    expect(grid.has("e1")).toBe(true);
    expect(grid.get("e1")?.x).toBe(100);
    expect(grid.get("e1")?.y).toBe(100);
  });

  it("update within same cell boundaries only updates coordinates", () => {
    grid.insert("e1", 100, 100, 30);
    const cellCountBefore = grid.cells.size;
    const result = grid.update("e1", 105, 110);
    expect(result).toBe(true);
    expect(grid.get("e1")?.x).toBe(105);
    expect(grid.get("e1")?.y).toBe(110);
    // Cell count should not change since entity stayed within same cells
    expect(grid.cells.size).toBe(cellCountBefore);
  });

  it("update across cell boundaries moves entity to new cells", () => {
    grid.insert("e1", 100, 100, 30);
    const cellCountBefore = grid.cells.size;
    // Move far enough to cross cell boundary (cellSize = 128)
    const result = grid.update("e1", 300, 300);
    expect(result).toBe(true);
    expect(grid.get("e1")?.x).toBe(300);
    expect(grid.get("e1")?.y).toBe(300);
    // Cell count may change since entity moved to different cells
    expect(grid.cells.size).toBeGreaterThanOrEqual(1);
  });

  it("update with radius change moves entity to new cells", () => {
    grid.insert("e1", 100, 100, 10);
    const result = grid.update("e1", 100, 100, 100);
    expect(result).toBe(true);
    expect(grid.get("e1")?.radius).toBe(100);
  });

  it("update returns false for non-existent entity", () => {
    const result = grid.update("missing", 100, 100);
    expect(result).toBe(false);
  });

  it("remove deletes entity from all cells", () => {
    grid.insert("e1", 100, 100, 30);
    expect(grid.has("e1")).toBe(true);
    const result = grid.remove("e1");
    expect(result).toBe(true);
    expect(grid.has("e1")).toBe(false);
  });

  it("remove cleans up empty cells", () => {
    grid.insert("e1", 100, 100, 30);
    const cellCountBefore = grid.cells.size;
    grid.remove("e1");
    // All cells that only contained e1 should be removed
    expect(grid.cells.size).toBeLessThan(cellCountBefore);
  });

  it("remove returns false for non-existent entity", () => {
    const result = grid.remove("missing");
    expect(result).toBe(false);
  });

  it("query finds entities within radius", () => {
    grid.insert("e1", 100, 100, 20);
    grid.insert("e2", 200, 200, 20);
    const results = grid.query(100, 100, 50);
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe("e1");
  });

  it("query respects type filter", () => {
    grid.insert("e1", 100, 100, 20, "player");
    grid.insert("e2", 100, 100, 20, "enemy");
    const results = grid.query(100, 100, 50, "player");
    expect(results.length).toBe(1);
    expect(results[0]?.type).toBe("player");
  });

  it("queryAll returns all entities", () => {
    grid.insert("e1", 100, 100, 20);
    grid.insert("e2", 200, 200, 20);
    const results = grid.queryAll();
    expect(results.length).toBe(2);
  });

  it("getStats returns correct metrics", () => {
    grid.insert("e1", 100, 100, 30);
    grid.insert("e2", 300, 300, 30);
    const stats = grid.getStats();
    expect(stats.entityCount).toBe(2);
    expect(stats.cellCount).toBeGreaterThan(0);
    expect(stats.averageEntitiesPerCell).toBeGreaterThan(0);
  });
});
