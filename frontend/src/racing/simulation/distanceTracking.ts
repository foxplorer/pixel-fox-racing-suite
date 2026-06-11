export interface HorizontalPosition {
  x: number
  z: number
}

export const DEFAULT_DISTANCE_TRACKING_STOP_SPEED = 0.1

export const getHorizontalDistanceDelta = (
  from: HorizontalPosition,
  to: HorizontalPosition
): number => {
  const dx = to.x - from.x
  const dz = to.z - from.z
  return Math.sqrt(dx * dx + dz * dz)
}

export const shouldTrackDistanceForSpeed = (
  speed: number,
  stopSpeed = DEFAULT_DISTANCE_TRACKING_STOP_SPEED
): boolean => {
  return Math.abs(speed) > stopSpeed
}

interface MutableRef<TValue> {
  current: TValue
}

export interface HorizontalDistanceAccumulatorResult {
  isTracking: boolean
  distanceDelta: number
  totalDistance: number
  initializedPreviousPosition: boolean
}

export const updateHorizontalDistanceAccumulator = <TPosition extends HorizontalPosition>({
  speed,
  position,
  previousPosition,
  totalDistanceTraveled,
  createPreviousPosition,
  copyPosition
}: {
  speed: number
  position: TPosition
  previousPosition: MutableRef<TPosition | null>
  totalDistanceTraveled: MutableRef<number>
  createPreviousPosition: () => TPosition
  copyPosition?: (target: TPosition, source: TPosition) => void
}): HorizontalDistanceAccumulatorResult => {
  if (!shouldTrackDistanceForSpeed(speed)) {
    previousPosition.current = null
    return {
      isTracking: false,
      distanceDelta: 0,
      totalDistance: totalDistanceTraveled.current,
      initializedPreviousPosition: false
    }
  }

  let distanceDelta = 0
  let initializedPreviousPosition = false

  if (previousPosition.current) {
    distanceDelta = getHorizontalDistanceDelta(previousPosition.current, position)
    totalDistanceTraveled.current += distanceDelta
  } else {
    previousPosition.current = createPreviousPosition()
    initializedPreviousPosition = true
  }

  if (copyPosition) {
    copyPosition(previousPosition.current, position)
  } else {
    Object.assign(previousPosition.current, position)
  }

  return {
    isTracking: true,
    distanceDelta,
    totalDistance: totalDistanceTraveled.current,
    initializedPreviousPosition
  }
}
