export type LapValidationInput = {
  trackLength: number
  distanceSinceLastLap: number
  hasCrossedStartLine: boolean
  minLapDistanceRatio?: number
  requiresReachedEnd?: boolean
  maxTrackT?: number | null
  reachedEndThreshold?: number
}

export type LapValidationResult = {
  isValid: boolean
  minLapDistance: number
  reasons: Array<'missing-track-length' | 'insufficient-distance' | 'already-crossed' | 'missing-reached-end'>
}

interface MutableRef<TValue> {
  current: TValue
}

export type LapAttemptSkippedReason = 'missing-track-length' | 'missing-lap-callback' | 'missing-lap-start'

export type LapCompletionAttemptResult = {
  completed: boolean
  skippedReasons: LapAttemptSkippedReason[]
  distanceSinceLastLap: number | null
  lapTime: number | null
  validation: LapValidationResult | null
}

export interface TrackProgressAccumulatorResult {
  distanceDelta: number
  totalDistance: number
  maxTrackT: number | null
}

export type TrackDirection = 1 | -1

export const validateLapCompletion = ({
  trackLength,
  distanceSinceLastLap,
  hasCrossedStartLine,
  minLapDistanceRatio = 0.9,
  requiresReachedEnd = false,
  maxTrackT = null,
  reachedEndThreshold = 0.9
}: LapValidationInput): LapValidationResult => {
  const minLapDistance = trackLength * minLapDistanceRatio
  const reasons: LapValidationResult['reasons'] = []

  if (!trackLength || trackLength <= 0) {
    reasons.push('missing-track-length')
  }

  if (distanceSinceLastLap < minLapDistance) {
    reasons.push('insufficient-distance')
  }

  if (hasCrossedStartLine) {
    reasons.push('already-crossed')
  }

  if (requiresReachedEnd && (maxTrackT === null || maxTrackT < reachedEndThreshold)) {
    reasons.push('missing-reached-end')
  }

  return {
    isValid: reasons.length === 0,
    minLapDistance,
    reasons
  }
}

export const attemptLapCompletion = ({
  trackLength,
  onLapComplete,
  lastLapTime,
  lastLapDistance,
  totalDistanceTraveled,
  hasCrossedStartLine,
  minLapDistanceRatio,
  requiresReachedEnd,
  maxTrackT,
  resetMaxTrackTOnCompletion,
  nowMs
}: {
  trackLength?: number
  onLapComplete?: (lapTime: number) => void
  lastLapTime: MutableRef<number | null>
  lastLapDistance: MutableRef<number>
  totalDistanceTraveled: MutableRef<number>
  hasCrossedStartLine: MutableRef<boolean>
  minLapDistanceRatio?: number
  requiresReachedEnd?: boolean
  maxTrackT?: MutableRef<number | null>
  resetMaxTrackTOnCompletion?: number
  nowMs: number
}): LapCompletionAttemptResult => {
  const skippedReasons: LapAttemptSkippedReason[] = []

  if (!trackLength) skippedReasons.push('missing-track-length')
  if (!onLapComplete) skippedReasons.push('missing-lap-callback')
  if (lastLapTime.current === null) skippedReasons.push('missing-lap-start')

  if (skippedReasons.length > 0) {
    return {
      completed: false,
      skippedReasons,
      distanceSinceLastLap: null,
      lapTime: null,
      validation: null
    }
  }

  const distanceSinceLastLap = totalDistanceTraveled.current - lastLapDistance.current
  const validation = validateLapCompletion({
    trackLength,
    distanceSinceLastLap,
    hasCrossedStartLine: hasCrossedStartLine.current,
    minLapDistanceRatio,
    requiresReachedEnd,
    maxTrackT: maxTrackT?.current
  })

  if (!validation.isValid) {
    return {
      completed: false,
      skippedReasons,
      distanceSinceLastLap,
      lapTime: null,
      validation
    }
  }

  const lapTime = (nowMs - lastLapTime.current) / 1000
  lastLapDistance.current = totalDistanceTraveled.current
  lastLapTime.current = nowMs
  hasCrossedStartLine.current = true

  if (maxTrackT && resetMaxTrackTOnCompletion !== undefined) {
    maxTrackT.current = resetMaxTrackTOnCompletion
  }

  onLapComplete(lapTime)

  return {
    completed: true,
    skippedReasons,
    distanceSinceLastLap,
    lapTime,
    validation
  }
}

export const updateTrackProgressAccumulator = ({
  currentTrackT,
  trackLength,
  lastTrackT,
  totalDistanceTraveled,
  maxTrackT,
  isNearTrack,
  maxForwardTJump = 0.1
}: {
  currentTrackT: number
  trackLength: number
  lastTrackT: MutableRef<number | null>
  totalDistanceTraveled: MutableRef<number>
  maxTrackT?: MutableRef<number | null>
  isNearTrack: boolean
  maxForwardTJump?: number
}): TrackProgressAccumulatorResult => {
  let distanceDelta = 0
  const previousTrackT = lastTrackT.current

  if (previousTrackT !== null) {
    let tDiff = currentTrackT - previousTrackT

    if (Math.abs(tDiff) > 0.5) {
      tDiff = tDiff > 0 ? tDiff - 1 : tDiff + 1
    }

    distanceDelta = Math.abs(tDiff) * trackLength
    totalDistanceTraveled.current += distanceDelta
  }

  if (maxTrackT && isNearTrack) {
    if (maxTrackT.current === null) {
      maxTrackT.current = currentTrackT
    } else if (previousTrackT !== null) {
      let tDiff = currentTrackT - previousTrackT

      if (tDiff < -0.5) {
        maxTrackT.current = 1
      } else if (tDiff > 0 && tDiff < maxForwardTJump) {
        maxTrackT.current = Math.max(maxTrackT.current, currentTrackT)
      }
    }
  }

  lastTrackT.current = currentTrackT

  return {
    distanceDelta,
    totalDistance: totalDistanceTraveled.current,
    maxTrackT: maxTrackT?.current ?? null
  }
}

export const getDirectionalTrackProgress = (
  currentTrackT: number,
  startTrackT: number,
  direction: TrackDirection
): number => {
  const rawProgress = direction === 1
    ? currentTrackT - startTrackT
    : startTrackT - currentTrackT

  return (rawProgress + 1) % 1
}

export const updateDirectionalLapProgressAccumulator = ({
  currentTrackT,
  startTrackT,
  direction,
  lastLapProgress,
  maxLapProgress,
  isNearTrack,
  maxForwardProgressJump = 0.15
}: {
  currentTrackT: number
  startTrackT: number
  direction: TrackDirection
  lastLapProgress: MutableRef<number | null>
  maxLapProgress: MutableRef<number | null>
  isNearTrack: boolean
  maxForwardProgressJump?: number
}): number | null => {
  const currentProgress = getDirectionalTrackProgress(currentTrackT, startTrackT, direction)
  const previousProgress = lastLapProgress.current

  if (isNearTrack) {
    if (maxLapProgress.current === null) {
      maxLapProgress.current = currentProgress
    } else if (previousProgress !== null) {
      let progressDelta = currentProgress - previousProgress

      if (progressDelta < -0.5) {
        maxLapProgress.current = 1
      } else if (progressDelta > 0 && progressDelta < maxForwardProgressJump) {
        maxLapProgress.current = Math.max(maxLapProgress.current, currentProgress)
      }
    }
  }

  lastLapProgress.current = currentProgress
  return maxLapProgress.current
}

export const finalizeLapDistanceFrame = ({
  justLeftStartLine,
  hasCrossedStartLine,
  totalDistanceTraveled,
  onDistanceUpdate
}: {
  justLeftStartLine: boolean
  hasCrossedStartLine: MutableRef<boolean>
  totalDistanceTraveled: MutableRef<number>
  onDistanceUpdate?: (distance: number) => void
}): void => {
  if (justLeftStartLine) {
    hasCrossedStartLine.current = false
  }

  onDistanceUpdate?.(totalDistanceTraveled.current)
}
