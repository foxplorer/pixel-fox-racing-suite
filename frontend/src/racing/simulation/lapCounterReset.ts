interface MutableRef<TValue> {
  current: TValue
}

interface LapCounterRefs {
  lastLapTime: MutableRef<number | null>
  lastLapDistance: MutableRef<number>
  hasCrossedStartLine: MutableRef<boolean>
  isOnStartLine: MutableRef<boolean>
  totalDistanceTraveled?: MutableRef<number>
  prevPositionForDistance?: MutableRef<unknown | null>
  maxTrackT?: MutableRef<number | null>
}

export const resetLapCountersForRaceStart = (
  refs: LapCounterRefs,
  nowMs: number
): void => {
  refs.lastLapTime.current = nowMs
  refs.lastLapDistance.current = 0
  refs.hasCrossedStartLine.current = false
  refs.isOnStartLine.current = false
  refs.totalDistanceTraveled && (refs.totalDistanceTraveled.current = 0)
  refs.prevPositionForDistance && (refs.prevPositionForDistance.current = null)
  refs.maxTrackT && (refs.maxTrackT.current = null)
}

export const resetLapCountersForCountdown = (refs: LapCounterRefs): void => {
  refs.lastLapTime.current = null
  refs.lastLapDistance.current = 0
  refs.hasCrossedStartLine.current = false
  refs.isOnStartLine.current = false
  refs.totalDistanceTraveled && (refs.totalDistanceTraveled.current = 0)
  refs.prevPositionForDistance && (refs.prevPositionForDistance.current = null)
  refs.maxTrackT && (refs.maxTrackT.current = null)
}

export const resetLapCountersForGameStatus = ({
  gameStatus,
  refs,
  nowMs
}: {
  gameStatus: string
  refs: LapCounterRefs
  nowMs: number
}): boolean => {
  if (gameStatus === 'racing') {
    resetLapCountersForRaceStart(refs, nowMs)
    return true
  }

  if (gameStatus === 'countdown') {
    resetLapCountersForCountdown(refs)
    return true
  }

  return false
}
