// Deterministic random number generator for consistent world/scenery generation.
export class SeededRandom {
  private seed: number

  constructor(seed: number = 12345) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  random(min: number = 0, max: number = 1): number {
    return min + this.next() * (max - min)
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random(min, max + 1))
  }
}

export const WORLD_SEED = 54321
