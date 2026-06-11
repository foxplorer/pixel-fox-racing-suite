import React from 'react'
import * as THREE from 'three'
import { trackCurve, startFinishPosition } from './TrackData'
import { TrackMinimap, type TrackMinimapPosition } from '../../racing/components/TrackMinimap'
import type { MinimapWorldPosition } from '../../racing/components/minimapGeometry'

interface MinimapProps {
  carPosition: MinimapWorldPosition | null
  trackCurve?: THREE.CatmullRomCurve3
  width?: number
  height?: number
  trackLocation?: string | null
  position?: TrackMinimapPosition
  updateEveryFrames?: number
}

export const Minimap: React.FC<MinimapProps> = ({
  carPosition,
  trackCurve: providedTrackCurve,
  width = 200,
  height = 200,
  trackLocation = null,
  position = 'bottom-right',
  updateEveryFrames
}) => {
  return (
    <TrackMinimap
      vehiclePosition={carPosition}
      trackCurve={providedTrackCurve || trackCurve}
      startFinishPosition={startFinishPosition}
      width={width}
      height={height}
      trackLocation={trackLocation}
      position={position}
      updateEveryFrames={updateEveryFrames}
    />
  )
}
