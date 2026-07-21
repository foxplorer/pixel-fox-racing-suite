import React, { memo } from 'react'
import * as THREE from 'three'
import { trackCurve, startFinishPosition as defaultStartFinishPosition } from './TrackData'
import { TrackMinimap, type TrackMinimapPosition } from '../../racing/components/TrackMinimap'
import {
  hasMinimapPositionChanged,
  type MinimapWorldPosition
} from '../../racing/components/minimapGeometry'

interface MinimapProps {
  carPosition: MinimapWorldPosition | null
  trackCurve?: THREE.CatmullRomCurve3
  width?: number
  height?: number
  trackLocation?: string | null
  position?: TrackMinimapPosition
  startFinishPosition?: THREE.Vector3
  updateEveryFrames?: number
}

const areMinimapPositionsEquivalent = (
  previous: MinimapWorldPosition | null,
  next: MinimapWorldPosition | null
): boolean => {
  if (previous === next) return true
  if (!previous || !next) return false
  return !hasMinimapPositionChanged(next, previous)
}

export const Minimap = memo<MinimapProps>(function Minimap({
  carPosition,
  trackCurve: providedTrackCurve,
  width = 200,
  height = 200,
  trackLocation = null,
  position = 'bottom-right',
  startFinishPosition: providedStartFinishPosition,
  updateEveryFrames
}) {
  return (
    <TrackMinimap
      vehiclePosition={carPosition}
      trackCurve={providedTrackCurve || trackCurve}
      startFinishPosition={providedStartFinishPosition || defaultStartFinishPosition}
      width={width}
      height={height}
      trackLocation={trackLocation}
      position={position}
      updateEveryFrames={updateEveryFrames}
    />
  )
}, (previous, next) => (
  previous.trackCurve === next.trackCurve &&
  previous.startFinishPosition === next.startFinishPosition &&
  previous.width === next.width &&
  previous.height === next.height &&
  previous.trackLocation === next.trackLocation &&
  previous.position === next.position &&
  previous.updateEveryFrames === next.updateEveryFrames &&
  areMinimapPositionsEquivalent(previous.carPosition, next.carPosition)
))
