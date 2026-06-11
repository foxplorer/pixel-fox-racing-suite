import * as THREE from 'three'
import aspenTrack from '../snowmobilerace/aspen.source.json'
import { calculateTrackInterior as calculateTrackInteriorFromCurve, convertGeoJSONToWaypoints, createHorizontalTrackFrames, getCurveStartPose } from '../../racing/core/trackGeometry'
import { getLegacyRoadHeightInfluence } from '../../racing/core/roadCorridor'
import { createSpatialTrackIndex } from '../../racing/core/spatialTrackIndex'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { logRacingDiagnostic } from '../../racing/debug/diagnostics'

// Configuration
const trackRuntimeConfig = getTrackRuntimeConfig('aspen')

// Track location for Aspen
export const trackLocation: string = 'Aspen'

// Generate waypoints from custom Aspen GeoJSON.
const waypoints = convertGeoJSONToWaypoints(aspenTrack, {
  worldSize: trackRuntimeConfig.worldSize
})

// Create smooth track curve
export const trackCurve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal', 0.5)

// Calculate track length
export const trackLength = trackCurve.getLength()

// Track segments for rendering
export const trackSegments = 900

// Find start/finish position for Watkins Glen (Dix)
// Start near the beginning of the track data
export const findStartFinishPosition = (): { position: THREE.Vector3, direction: THREE.Vector3 } => {
  const START_FINISH_T = 0.885

  const pose = getCurveStartPose(trackCurve, START_FINISH_T)

  logRacingDiagnostic(`✅ Aspen Start/Finish line positioned at t=${START_FINISH_T.toFixed(4)} (${(START_FINISH_T * trackLength).toFixed(0)}m into track)`)

  return pose
}

export const startFinishData = findStartFinishPosition()
export const startFinishPosition = startFinishData.position
export const startFinishDirection = startFinishData.direction.clone().negate()

export const calculateTrackInterior = () => calculateTrackInteriorFromCurve(trackCurve)

export const trackInterior = calculateTrackInterior()

export const trackFrames = createHorizontalTrackFrames(trackCurve, trackSegments)

const spatialTrackIndex = createSpatialTrackIndex(trackCurve, trackRuntimeConfig.spatialIndex)
export const GRID_SIZE = spatialTrackIndex.gridSize
export const spatialHash = spatialTrackIndex.hash
export const trackSamples = spatialTrackIndex.samples

// Height cache for performance
const heightCache = new Map<string, { height: number, factor: number, timestamp: number }>()
const CACHE_TTL = 100
const CACHE_GRANULARITY = 0.5

export const getTrackHeightAndInfluence = (x: number, z: number, currentY?: number, trackT?: number): { height: number, factor: number } => {
  const now = Date.now()

  const roundedTrackT = trackT !== undefined ? Math.floor(trackT * 100) / 100 : undefined
  const cacheKey = `${Math.floor(x / CACHE_GRANULARITY)},${Math.floor(z / CACHE_GRANULARITY)}${roundedTrackT !== undefined ? `,t${roundedTrackT.toFixed(2)}` : ''}`
  const cached = heightCache.get(cacheKey)
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return { height: cached.height, factor: cached.factor }
  }

  const gx = Math.floor(x / GRID_SIZE)
  const gz = Math.floor(z / GRID_SIZE)
  const key = `${gx},${gz}`

  const indices = spatialHash.get(key)
  if (!indices) {
    return { height: 0, factor: 0 }
  }

  let minScore = Infinity
  let closestIndex = -1
  let fallbackIndex = -1
  let fallbackDistSq = Infinity

  const MAX_VERTICAL_DISTANCE = 40
  const MAX_TRACK_T_DIFF = 0.12

  for (const idx of indices) {
    const sample = trackSamples[idx]
    const dx = x - sample.pos.x
    const dz = z - sample.pos.z
    const horizontalDistSq = dx * dx + dz * dz

    if (trackT !== undefined) {
      let tDiff = Math.abs(trackT - sample.t)
      if (tDiff > 0.5) {
        tDiff = 1 - tDiff
      }
      if (tDiff > MAX_TRACK_T_DIFF) {
        continue
      }
    }

    if (trackT === undefined && horizontalDistSq < fallbackDistSq) {
      fallbackDistSq = horizontalDistSq
      fallbackIndex = idx
    }

    if (currentY !== undefined) {
      const dy = Math.abs(currentY - sample.pos.y)

      if (dy > MAX_VERTICAL_DISTANCE) {
        continue
      }

      const verticalWeight = 3.0
      const trackTWeight = trackT !== undefined ? 5.0 : 0
      let tDiff = 0
      if (trackT !== undefined) {
        tDiff = Math.abs(trackT - sample.t)
        if (tDiff > 0.5) tDiff = 1 - tDiff
      }
      const score = horizontalDistSq + (dy * dy * verticalWeight) + (tDiff * tDiff * trackTWeight * 10000)

      if (score < minScore) {
        minScore = score
        closestIndex = idx
      }
    } else {
      let score = horizontalDistSq
      if (trackT !== undefined) {
        let tDiff = Math.abs(trackT - sample.t)
        if (tDiff > 0.5) tDiff = 1 - tDiff
        score += tDiff * tDiff * 10000
      }
      if (score < minScore) {
        minScore = score
        closestIndex = idx
      }
    }
  }

  if (closestIndex === -1) {
    if (fallbackIndex === -1) return { height: 0, factor: 0 }
    closestIndex = fallbackIndex
  }

  const sample = trackSamples[closestIndex]
  const dx = x - sample.pos.x
  const dz = z - sample.pos.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  const result = getLegacyRoadHeightInfluence(dist, sample.pos.y, trackRuntimeConfig.roadCorridor)

  heightCache.set(cacheKey, { ...result, timestamp: now })

  return result
}

logRacingDiagnostic(`✅ Aspen Track loaded: ${trackLocation}, ${waypoints.length} waypoints, ${trackLength.toFixed(0)}m`)
