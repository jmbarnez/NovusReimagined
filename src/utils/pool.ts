/**
 * Generic object pool for simulation entities.
 *
 * Use for high-churn ephemeral types (bullets, particles, beams, etc.)
 * to eliminate per-spawn GC pressure.
 *
 * Integration rules:
 * - acquire() may return a stale object; reset ALL fields before use.
 * - release() returns the object to the free list (up to maxSize).
 * - releaseAll() drains an array into the pool before clearing it.
 */

export interface ObjectPool<T> {
  /** Pull an object from the pool or create a blank one. */
  acquire(): T;
  /** Return a single object to the pool. */
  release(obj: T): void;
  /** Drain up to maxSize objects from an array into the pool. */
  releaseAll(arr: readonly T[]): void;
  /** Empty the free list (useful for tests). */
  clear(): void;
  /** Current number of pooled objects available for reuse. */
  size(): number;
}

export function createPool<T>(maxSize: number): ObjectPool<T> {
  const free: T[] = [];
  return {
    acquire() {
      return free.pop() ?? ({} as T);
    },
    release(obj) {
      if (free.length < maxSize) {
        free.push(obj);
      }
    },
    releaseAll(arr) {
      const take = Math.min(arr.length, maxSize - free.length);
      for (let i = 0; i < take; i++) {
        free.push(arr[i]!);
      }
    },
    clear() {
      free.length = 0;
    },
    size() {
      return free.length;
    },
  };
}
