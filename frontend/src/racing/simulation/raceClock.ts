export interface RaceClock {
  nowMs: () => number
}

export const browserRaceClock: RaceClock = {
  nowMs: () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now()
    }

    return Date.now()
  }
}

export const elapsedSeconds = (startMs: number, endMs: number): number => {
  return (endMs - startMs) / 1000
}

export const sanitizeSimulationDeltaSeconds = (
  deltaSeconds: number,
  maxDeltaSeconds: number
): number => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0
  }

  return Math.min(deltaSeconds, maxDeltaSeconds)
}
