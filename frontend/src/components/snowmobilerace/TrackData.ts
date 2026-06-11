import * as THREE from 'three'
import aspenTrack from './aspen.source.json'
import { getTerrainHeight } from './TerrainSystem'
import { convertGeoJSONToWaypoints, createHorizontalTrackFrames, getCurveStartPose } from '../../racing/core/trackGeometry'
import { createSpatialTrackIndex } from '../../racing/core/spatialTrackIndex'
import { getTotalTrackWidth } from '../../racing/core/trackProfile'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { logRacingDiagnostic } from '../../racing/debug/diagnostics'

// Configuration
const trackRuntimeConfig = getTrackRuntimeConfig('aspen')
const TRACK_WIDTH = trackRuntimeConfig.surfaceProfile.trackWidth
const TOTAL_WIDTH = getTotalTrackWidth(trackRuntimeConfig.surfaceProfile)

export const trackLocation: string = 'Aspen'

// Generate waypoints from custom Aspen GeoJSON. Keep Y on the procedural
// terrain system so snowmobile physics and rendered snow remain aligned.
const waypoints = convertGeoJSONToWaypoints(aspenTrack, {
  worldSize: trackRuntimeConfig.worldSize,
  getY: getTerrainHeight
})

// Create smooth track curve
export const trackCurve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal', 0.5)

// Calculate track length
export const trackLength = trackCurve.getLength()

// Track segments for rendering
export const trackSegments = 900

// Find start/finish position
export const findStartFinishPosition = (): { position: THREE.Vector3, direction: THREE.Vector3 } => {
  // Start on a straightened, locally flattened snow pad.
  const START_FINISH_T = 0.885

  const pose = getCurveStartPose(trackCurve, START_FINISH_T, {
    getY: getTerrainHeight
  })

  logRacingDiagnostic(`✅ Aspen Start/Finish line positioned at t=${START_FINISH_T.toFixed(4)} (${(START_FINISH_T * trackLength).toFixed(0)}m into track)`)

  return pose
}

export const startFinishData = findStartFinishPosition()
export const startFinishPosition = startFinishData.position
export const startFinishDirection = startFinishData.direction.clone().negate()

export const trackFrames = createHorizontalTrackFrames(trackCurve, trackSegments)

const spatialTrackIndex = createSpatialTrackIndex(trackCurve, {
  ...trackRuntimeConfig.spatialIndex,
  getY: getTerrainHeight
})
export const GRID_SIZE = spatialTrackIndex.gridSize
export const spatialHash = spatialTrackIndex.hash
export const trackSamples = spatialTrackIndex.samples

logRacingDiagnostic(`✅ Aspen Track loaded: ${trackLocation}, ${waypoints.length} waypoints, ${trackLength.toFixed(0)}m`)
