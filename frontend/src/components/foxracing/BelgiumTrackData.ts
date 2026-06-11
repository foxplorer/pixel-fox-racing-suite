import * as THREE from 'three'
import spaTrack from './belgium.source.json'
import { convertGeoJSONToWaypoints, getCurveStartPose } from '../../racing/core/trackGeometry'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { logRacingDiagnostic } from '../../racing/debug/diagnostics'

const trackRuntimeConfig = getTrackRuntimeConfig('belgium')

// Track location from GeoJSON properties
export const trackLocation: string = 'Belgium'

// Generate waypoints from Belgium GeoJSON
const waypoints = convertGeoJSONToWaypoints(spaTrack, {
  worldSize: trackRuntimeConfig.worldSize
})

// Create smooth track curve
export const trackCurve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal', 0.5)

// Calculate track length
export const trackLength = trackCurve.getLength()

// Find start/finish position for Belgium
// t=0.9845 is the actual start/finish line position (found by driving to the real location)
export const findStartFinishPosition = (): { position: THREE.Vector3, direction: THREE.Vector3 } => {
  const START_FINISH_T = 0.9845

  return getCurveStartPose(trackCurve, START_FINISH_T)
}

export const startFinishData = findStartFinishPosition()
export const startFinishPosition = startFinishData.position
export const startFinishDirection = startFinishData.direction.clone().negate()

logRacingDiagnostic(`✅ Belgium Track loaded: ${trackLocation}, ${waypoints.length} waypoints, ${trackLength.toFixed(0)}m`)
