export type CarCameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

export interface CarCameraConfig {
  height: number
  distance: number
  minDistance: number
  maxDistance: number
  maxDeltaSeconds: number
  velocityPredictionSeconds: number
  targetSmoothResetDistance: number
  simpleSmoothingRate: number
  smoothSmoothingRate: number
  dampedSmoothingRate: number
  targetSmoothSmoothingRate: number
  targetSmoothTargetRate: number
  sanLuisTargetSmoothTargetRate: number
}

export interface CarCameraZoneConfig {
  startT: number
  endT: number
  height: number
  distance: number
  minDistance: number
  maxDistance: number
  lookYOffset?: number
}

export const SHARED_CAR_CAMERA: CarCameraConfig = {
  height: 8,
  distance: 15,
  minDistance: 10,
  maxDistance: 20,
  maxDeltaSeconds: 0.05,
  velocityPredictionSeconds: 0.05,
  targetSmoothResetDistance: 25,
  simpleSmoothingRate: 15,
  smoothSmoothingRate: 8,
  dampedSmoothingRate: 4,
  targetSmoothSmoothingRate: 8,
  targetSmoothTargetRate: 5,
  sanLuisTargetSmoothTargetRate: 4
}

export const capCameraDelta = (
  deltaSeconds: number,
  config: CarCameraConfig = SHARED_CAR_CAMERA
): number => {
  return Math.min(deltaSeconds, config.maxDeltaSeconds)
}

export const getCarCameraSmoothingRate = (
  mode: CarCameraMode,
  config: CarCameraConfig = SHARED_CAR_CAMERA
): number => {
  if (mode === 'damped') return config.dampedSmoothingRate
  if (mode === 'targetsmooth') return config.targetSmoothSmoothingRate
  if (mode === 'smooth') return config.smoothSmoothingRate
  return config.simpleSmoothingRate
}

export const getExponentialSmoothingFactor = (deltaSeconds: number, rate: number): number => {
  return 1 - Math.exp(-deltaSeconds * rate)
}

export const shouldResetTargetSmoothCamera = (
  distanceToRawTarget: number,
  config: CarCameraConfig = SHARED_CAR_CAMERA
): boolean => {
  return !Number.isFinite(distanceToRawTarget) || distanceToRawTarget > config.targetSmoothResetDistance
}

export const clampCameraDistance = (
  currentDistance: number,
  config: CarCameraConfig = SHARED_CAR_CAMERA
): number => {
  return Math.max(config.minDistance, Math.min(config.maxDistance, currentDistance))
}

export const isTrackTInRange = (trackT: number, startT: number, endT: number): boolean => {
  const normalizedTrackT = ((trackT % 1) + 1) % 1
  const normalizedStartT = ((startT % 1) + 1) % 1
  const normalizedEndT = ((endT % 1) + 1) % 1

  if (normalizedStartT <= normalizedEndT) {
    return normalizedTrackT >= normalizedStartT && normalizedTrackT <= normalizedEndT
  }

  return normalizedTrackT >= normalizedStartT || normalizedTrackT <= normalizedEndT
}

export const findCarCameraZoneForTrackT = (
  trackT: number | null | undefined,
  zones: readonly CarCameraZoneConfig[] = []
): CarCameraZoneConfig | undefined => {
  if (trackT === null || trackT === undefined || !Number.isFinite(trackT)) return undefined
  return zones.find(zone => isTrackTInRange(trackT, zone.startT, zone.endT))
}

export const clampCameraDistanceForZone = (
  currentDistance: number,
  zone?: Pick<CarCameraZoneConfig, 'minDistance' | 'maxDistance'>
): number => {
  if (!zone) return clampCameraDistance(currentDistance)
  return Math.max(zone.minDistance, Math.min(zone.maxDistance, currentDistance))
}
