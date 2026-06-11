import type { CatmullRomCurve3, Vector3 } from 'three'
import type { SpatialTrackIndex } from './spatialTrackIndex'
import { findIndexedTrackPositionT } from './spatialTrackIndex'
import type { TrackProximityConfig } from './trackProximity'
import { isNearIndexedTrack, isOnIndexedTrack } from './trackProximity'

export interface IndexedTrackQueries {
  isOnTrack: (position: Vector3, trackCurve?: CatmullRomCurve3) => boolean
  isNearTrack: (position: Vector3, trackCurve?: CatmullRomCurve3) => boolean
  findTrackPosition: (position: Vector3, trackCurve?: CatmullRomCurve3) => number
}

export const createIndexedTrackQueries = ({
  trackIndex,
  config,
  startPosition
}: {
  trackIndex: SpatialTrackIndex
  config: TrackProximityConfig
  startPosition: Vector3
}): IndexedTrackQueries => {
  return {
    isOnTrack: (position, trackCurve) => {
      return isOnIndexedTrack({
        position,
        trackCurve,
        trackIndex,
        config,
        distanceToStart: position.distanceTo(startPosition)
      })
    },
    isNearTrack: (position, trackCurve) => {
      if (!trackCurve) return true
      return isNearIndexedTrack(position, trackIndex, config)
    },
    findTrackPosition: (position, trackCurve) => {
      if (!trackCurve) return 0
      return findIndexedTrackPositionT(trackIndex, trackCurve, position.x, position.z)
    }
  }
}
