import type { SpatialTrackIndex } from './spatialTrackIndex'
import { findNearestTrackSample } from './spatialTrackIndex'
import type { CatmullRomCurve3 } from 'three'

export interface TrackProximityConfig {
  trackWidth: number
  trackMargin: number
  nearTrackDistance: number
  startTolerance: number
}

export type TrackProximityKey = 'standard-car' | 'san-luis' | 'snow'

export const STANDARD_CAR_TRACK_PROXIMITY: TrackProximityConfig = {
  trackWidth: 18,
  trackMargin: 2,
  nearTrackDistance: 30,
  startTolerance: 5
}

export const SAN_LUIS_CAR_TRACK_PROXIMITY: TrackProximityConfig = {
  ...STANDARD_CAR_TRACK_PROXIMITY,
  trackWidth: 12
}

export const SNOW_TRACK_PROXIMITY: TrackProximityConfig = {
  ...STANDARD_CAR_TRACK_PROXIMITY
}

export const TRACK_PROXIMITY_CONFIGS: Record<TrackProximityKey, TrackProximityConfig> = {
  'standard-car': STANDARD_CAR_TRACK_PROXIMITY,
  'san-luis': SAN_LUIS_CAR_TRACK_PROXIMITY,
  snow: SNOW_TRACK_PROXIMITY
}

export const getTrackProximityConfig = (
  proximityKey: TrackProximityKey
): TrackProximityConfig => {
  return TRACK_PROXIMITY_CONFIGS[proximityKey]
}

export const getOnTrackDistance = (config: TrackProximityConfig): number => {
  return config.trackWidth / 2 + config.trackMargin
}

export const isWithinDistanceSq = (distanceSq: number, maxDistance: number): boolean => {
  return distanceSq <= maxDistance * maxDistance
}

export const isWithinStartTolerance = (
  distance: number,
  config: TrackProximityConfig
): boolean => {
  return distance < config.startTolerance
}

export interface IndexedTrackProximityPosition {
  x: number
  z: number
}

export const isNearIndexedTrack = (
  position: IndexedTrackProximityPosition,
  trackIndex: SpatialTrackIndex,
  config: TrackProximityConfig
): boolean => {
  const { distanceSq } = findNearestTrackSample(trackIndex, position.x, position.z)
  return isWithinDistanceSq(distanceSq, config.nearTrackDistance)
}

export interface IsOnIndexedTrackOptions {
  position: IndexedTrackProximityPosition
  trackCurve?: CatmullRomCurve3
  trackIndex: SpatialTrackIndex
  config: TrackProximityConfig
  distanceToStart: number
  coarseSamples?: number
}

export const isOnIndexedTrack = ({
  position,
  trackCurve,
  trackIndex,
  config,
  distanceToStart,
  coarseSamples = 60
}: IsOnIndexedTrackOptions): boolean => {
  if (!trackCurve) {
    return true
  }

  const maxDistance = getOnTrackDistance(config)

  if (isWithinStartTolerance(distanceToStart, config)) {
    return true
  }

  let { distanceSq: minDistanceSq } = findNearestTrackSample(trackIndex, position.x, position.z)

  if (isWithinDistanceSq(minDistanceSq, maxDistance)) {
    return true
  }

  for (let i = 0; i <= coarseSamples; i++) {
    const t = i / coarseSamples
    const curvePoint = trackCurve.getPointAt(t)
    const dx = position.x - curvePoint.x
    const dz = position.z - curvePoint.z
    const distanceSq = dx * dx + dz * dz

    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq
    }
  }

  return isWithinDistanceSq(minDistanceSq, maxDistance)
}
