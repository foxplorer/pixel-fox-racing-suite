import { elapsedSeconds } from './raceClock'

export const DEFAULT_RACING_DISPLAY_UPDATE_INTERVAL_FRAMES = 6

export interface AdvanceDisplayUpdateCounterResult {
  counter: number
  shouldUpdate: boolean
}

export const advanceDisplayUpdateCounter = (
  counter: number,
  intervalFrames = DEFAULT_RACING_DISPLAY_UPDATE_INTERVAL_FRAMES
): AdvanceDisplayUpdateCounterResult => {
  if (!Number.isFinite(counter) || counter < 0) {
    counter = 0
  }

  if (!Number.isFinite(intervalFrames) || intervalFrames <= 0) {
    intervalFrames = DEFAULT_RACING_DISPLAY_UPDATE_INTERVAL_FRAMES
  }

  const nextCounter = (counter + 1) % intervalFrames
  return {
    counter: nextCounter,
    shouldUpdate: nextCounter === 0
  }
}

export const getLapDisplayTimeSeconds = (
  lapStartMs: number | null,
  nowMs: number
): number => {
  if (lapStartMs === null) {
    return 0
  }

  return elapsedSeconds(lapStartMs, nowMs)
}

export const getSpeedDisplayValue = (speed: number): number => {
  return Math.abs(speed)
}

interface MutableRef<TValue> {
  current: TValue
}

export const notifyLapDisplayUpdate = ({
  counter,
  lapStartMs,
  nowMs,
  onLapTimeUpdate
}: {
  counter: MutableRef<number>
  lapStartMs: number | null
  nowMs: number
  onLapTimeUpdate?: (currentLapTime: number) => void
}): void => {
  const update = advanceDisplayUpdateCounter(counter.current)
  counter.current = update.counter

  if (update.shouldUpdate && onLapTimeUpdate) {
    onLapTimeUpdate(getLapDisplayTimeSeconds(lapStartMs, nowMs))
  }
}

export const notifySpeedDisplayUpdate = ({
  counter,
  speed,
  onSpeedUpdate
}: {
  counter: MutableRef<number>
  speed: number
  onSpeedUpdate?: (speed: number) => void
}): void => {
  const update = advanceDisplayUpdateCounter(counter.current)
  counter.current = update.counter

  if (update.shouldUpdate && onSpeedUpdate) {
    onSpeedUpdate(getSpeedDisplayValue(speed))
  }
}
