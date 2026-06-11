import { shouldTrackDistanceForSpeed } from '../simulation/distanceTracking'
import type { CarHandlingConfig } from './carHandling'
import { SHARED_CAR_HANDLING } from './carHandling'

export interface CarOffTrackBounceConfig {
  groundHeight: number
  bumpIntensity: number
  bumpFrequency: number
  secondaryFrequencyMultiplier: number
  secondaryIntensityMultiplier: number
}

export const SHARED_CAR_OFF_TRACK_BOUNCE: CarOffTrackBounceConfig = {
  groundHeight: 0.1,
  bumpIntensity: 0.4,
  bumpFrequency: 15.0,
  secondaryFrequencyMultiplier: 1.7,
  secondaryIntensityMultiplier: 0.5
}

export interface GetCarSurfaceVisualYOptions {
  isOnTrack: boolean
  speed: number
  elapsedTime: number
  handling?: CarHandlingConfig
  bounce?: CarOffTrackBounceConfig
}

export const getCarSurfaceVisualY = ({
  isOnTrack,
  speed,
  elapsedTime,
  handling = SHARED_CAR_HANDLING,
  bounce = SHARED_CAR_OFF_TRACK_BOUNCE
}: GetCarSurfaceVisualYOptions): number => {
  if (isOnTrack || !shouldTrackDistanceForSpeed(speed)) {
    return bounce.groundHeight
  }

  const speedFactor = Math.min(Math.abs(speed) / handling.maxSpeedOffTrack, 1.0)
  const primaryBump = Math.sin(elapsedTime * bounce.bumpFrequency) * bounce.bumpIntensity * speedFactor
  const secondaryBump = Math.sin(
    elapsedTime * bounce.bumpFrequency * bounce.secondaryFrequencyMultiplier
  ) * bounce.bumpIntensity * bounce.secondaryIntensityMultiplier * speedFactor

  return bounce.groundHeight + primaryBump + secondaryBump
}
