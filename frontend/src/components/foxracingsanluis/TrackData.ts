import * as THREE from 'three'
import {
  createClosedTrackCurveFromWaypoints,
  createParallelTransportFrames,
  createSmoothedClosedWaypointPath
} from '../../racing/core/trackGeometry'
import { createSpatialTrackIndex } from '../../racing/core/spatialTrackIndex'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { resolveTrackStartPose } from '../../racing/tracks/trackStartPose'

const trackRuntimeConfig = getTrackRuntimeConfig('san-luis')
const startPose = resolveTrackStartPose('san-luis')

// Start/Finish position for San Luis track
export const startFinishPosition = startPose.position

// Direction the track goes at start/finish line (towards positive Z)
export const startFinishDirection = startPose.direction

// Track location name
export const trackLocation = 'San Luis'

export const trackControlPoints = [
  new THREE.Vector3(0, 0.1, 0),        // Start/Finish line
  new THREE.Vector3(0, 0.1, 300),      // End of start straight
  new THREE.Vector3(400, 0.1, 600),    // After first curve
  new THREE.Vector3(800, 0.1, 700),    // Long straightaway
  new THREE.Vector3(1200, 0.1, 500),   // After curve
  new THREE.Vector3(1400, 0.1, 0),     // Straight section
  new THREE.Vector3(1200, 0.1, -500),  // U-turn area
  new THREE.Vector3(800, 0.1, -700),   // Back straight
  new THREE.Vector3(400, 0.1, -600),   // Curve back
  new THREE.Vector3(0, 0.1, -300),     // Final straight
  new THREE.Vector3(0, 0.1, 0)         // Back to start
]

// Generate track curve from waypoints (same logic as FoxRacingWorld)
// This creates a CatmullRomCurve3 that matches the track in FoxRacingWorld
export const generateTrackCurve = (): THREE.CatmullRomCurve3 => {
  return createClosedTrackCurveFromWaypoints(trackControlPoints, {
    pointsBetweenWaypoints: 30,
    groundY: 0.1,
    transitionPoints: 10,
    curveType: 'centripetal',
    tension: 0.8
  })
}

// Export the track curve (generated once)
export const trackCurve = generateTrackCurve()
export const trackLength = trackCurve.getLength()
export const trackSegments = createSmoothedClosedWaypointPath(trackControlPoints, {
  pointsBetweenWaypoints: 30,
  groundY: 0.1,
  transitionPoints: 10
}).length - 1
export const trackFrames = createParallelTransportFrames(trackCurve, trackSegments)

const spatialTrackIndex = createSpatialTrackIndex(trackCurve, trackRuntimeConfig.spatialIndex)
export const GRID_SIZE = spatialTrackIndex.gridSize
export const spatialHash = spatialTrackIndex.hash
export const trackSamples = spatialTrackIndex.samples
