import * as THREE from 'three'
import { MOUNTAIN_CONFIG } from './CentralMountain'
import { SeededRandom } from '../../racing/core/seededRandom'
import australiaTrack from './australia.source.json'
import { calculateTrackInterior as calculateTrackInteriorFromCurve, convertGeoJSONToWaypoints, createHorizontalTrackFrames } from '../../racing/core/trackGeometry'
import { getLegacyRoadHeightInfluence } from '../../racing/core/roadCorridor'
import { createSpatialTrackIndex } from '../../racing/core/spatialTrackIndex'
import { getTrackRuntimeConfig } from '../../racing/tracks/trackRuntimeConfig'
import { resolveTrackStartPose } from '../../racing/tracks/trackStartPose'
import { logRacingDiagnostic, warnRacingDiagnostic } from '../../racing/debug/diagnostics'

// Configuration
const trackRuntimeConfig = getTrackRuntimeConfig('australia')
const AUSTRALIA_AUTHORED_ELEVATION_SCALE = 0.38

// Track loading configuration
let USE_GEOJSON_TRACK = false
let GEOJSON_TRACK_DATA: any = null

// Load GeoJSON track data from file path
export const loadGeoJSONTrack = async (geojsonPath: string) => {
  try {
    const response = await fetch(geojsonPath)
    const data = await response.json()
    USE_GEOJSON_TRACK = true
    GEOJSON_TRACK_DATA = data
    logRacingDiagnostic(`✅ Loaded GeoJSON track: ${data.features?.[0]?.properties?.Name || 'Unknown'}`)
    return data
  } catch (error) {
    console.error('Failed to load GeoJSON track:', error)
    USE_GEOJSON_TRACK = false
    return null
  }
}

// User-facing track location. Source GeoJSON names are kept only as provenance data.
export let trackLocation: string | null = null

// Set GeoJSON track data directly (useful for importing JSON)
export const setGeoJSONTrack = (geojsonData: any) => {
  USE_GEOJSON_TRACK = true
  GEOJSON_TRACK_DATA = geojsonData
  trackLocation = 'Australia'
  logRacingDiagnostic(`✅ Set GeoJSON track: ${geojsonData.features?.[0]?.properties?.Name || 'Unknown'}`)
  if (trackLocation) {
    logRacingDiagnostic(`📍 Track Location: ${trackLocation}`)
  }
}

// Use manual track generation (default)
export const useManualTrack = () => {
  USE_GEOJSON_TRACK = false
  GEOJSON_TRACK_DATA = null
  logRacingDiagnostic('✅ Using manually generated track')
}

// ============================================================================
// GEOJSON TRACK LOADING
// ============================================================================
// Load and set the Austin track automatically
// The track will be converted and used when the module loads.
// All tracks are scaled to fit a reasonable world size and placed at ground level (y=0).
// ============================================================================

// Set the Australia track (imported at top of file).
setGeoJSONTrack(australiaTrack)

// Generate country-themed racing circuit - all ground level, no intersections, large area
// Track layout: Start/finish on north-south straight, final straight approaches from behind (south)
// and passes through start/finish in same direction (north)
const generateTrackWaypoints = () => {
  const waypoints: THREE.Vector3[] = []
  
  // All points at ground level (y = 0)
  const groundY = 0
  
  // Start/Finish line at origin, track runs north-south
  // First straight goes north (negative Z), final straight also goes north through start/finish
  
  // 1. Start/Finish line (heading north)
  waypoints.push(new THREE.Vector3(0, groundY, 0))
  
  // 2. Start straight (heading north) - long straightaway
  waypoints.push(new THREE.Vector3(0, groundY, -300))
  waypoints.push(new THREE.Vector3(0, groundY, -600))
  waypoints.push(new THREE.Vector3(0, groundY, -900))
  waypoints.push(new THREE.Vector3(0, groundY, -1200))
  
  // 3. Right turn (sweeper) - Turn 1 (90 degrees)
  const turn1Radius = 300
  const turn1CenterX = turn1Radius
  const turn1CenterZ = -1200
  for (let i = 1; i <= 12; i++) {
    const angle = Math.PI / 2 - (i / 13) * (Math.PI / 2) // 90 degrees right
    const x = turn1CenterX - turn1Radius * Math.cos(angle)
    const z = turn1CenterZ + turn1Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 4. Long straight (heading east)
  waypoints.push(new THREE.Vector3(300, groundY, -900))
  waypoints.push(new THREE.Vector3(600, groundY, -900))
  waypoints.push(new THREE.Vector3(900, groundY, -900))
  waypoints.push(new THREE.Vector3(1200, groundY, -900))
  waypoints.push(new THREE.Vector3(1500, groundY, -900))
  waypoints.push(new THREE.Vector3(1800, groundY, -900))
  waypoints.push(new THREE.Vector3(2100, groundY, -900))
  
  // 5. Left hairpin - Turn 2 (180 degrees)
  const turn2Radius = 250
  const turn2CenterX = 2400
  const turn2CenterZ = -900
  for (let i = 1; i <= 14; i++) {
    const angle = Math.PI + (i / 15) * Math.PI // 180 degrees left
    const x = turn2CenterX + turn2Radius * Math.cos(angle)
    const z = turn2CenterZ + turn2Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 6. Straight (heading west)
  waypoints.push(new THREE.Vector3(2400, groundY, -650))
  waypoints.push(new THREE.Vector3(2400, groundY, -400))
  waypoints.push(new THREE.Vector3(2400, groundY, -150))
  waypoints.push(new THREE.Vector3(2400, groundY, 100))
  waypoints.push(new THREE.Vector3(2400, groundY, 350))
  
  // 7. Right turn - Turn 3 (90 degrees, heading south)
  const turn3Radius = 250
  const turn3CenterX = 2400
  const turn3CenterZ = 600
  for (let i = 1; i <= 12; i++) {
    const angle = Math.PI / 2 + (i / 13) * (Math.PI / 2) // 90 degrees right
    const x = turn3CenterX - turn3Radius * Math.cos(angle)
    const z = turn3CenterZ + turn3Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 8. Long straight (heading south)
  waypoints.push(new THREE.Vector3(2150, groundY, 850))
  waypoints.push(new THREE.Vector3(2150, groundY, 1200))
  waypoints.push(new THREE.Vector3(2150, groundY, 1500))
  waypoints.push(new THREE.Vector3(2150, groundY, 1800))
  
  // 9. Left turn - Turn 4 (90 degrees, heading east)
  const turn4Radius = 220
  const turn4CenterX = 1900
  const turn4CenterZ = 1800
  for (let i = 1; i <= 12; i++) {
    const angle = (i / 13) * (Math.PI / 2) // 90 degrees left
    const x = turn4CenterX + turn4Radius * Math.cos(angle)
    const z = turn4CenterZ + turn4Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 10. Long straight (heading east)
  waypoints.push(new THREE.Vector3(2120, groundY, 2020))
  waypoints.push(new THREE.Vector3(1800, groundY, 2020))
  waypoints.push(new THREE.Vector3(1500, groundY, 2020))
  waypoints.push(new THREE.Vector3(1200, groundY, 2020))
  waypoints.push(new THREE.Vector3(900, groundY, 2020))
  waypoints.push(new THREE.Vector3(600, groundY, 2020))
  waypoints.push(new THREE.Vector3(300, groundY, 2020))
  
  // 11. Right turn - Turn 5 (90 degrees, heading north)
  const turn5Radius = 220
  const turn5CenterX = 300
  const turn5CenterZ = 2240
  for (let i = 1; i <= 12; i++) {
    const angle = -Math.PI / 2 + (i / 13) * (Math.PI / 2) // 90 degrees right
    const x = turn5CenterX - turn5Radius * Math.cos(angle)
    const z = turn5CenterZ + turn5Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 12. Long straight (heading north)
  waypoints.push(new THREE.Vector3(80, groundY, 2460))
  waypoints.push(new THREE.Vector3(80, groundY, 2200))
  waypoints.push(new THREE.Vector3(80, groundY, 1900))
  waypoints.push(new THREE.Vector3(80, groundY, 1600))
  waypoints.push(new THREE.Vector3(80, groundY, 1300))
  waypoints.push(new THREE.Vector3(80, groundY, 1000))
  waypoints.push(new THREE.Vector3(80, groundY, 700))
  waypoints.push(new THREE.Vector3(80, groundY, 400))
  waypoints.push(new THREE.Vector3(80, groundY, 200))
  
  // 13. Left turn - Turn 6 (90 degrees, heading west)
  const turn6Radius = 220
  const turn6CenterX = 300
  const turn6CenterZ = 200
  for (let i = 1; i <= 12; i++) {
    const angle = Math.PI / 2 + (i / 13) * (Math.PI / 2) // 90 degrees left
    const x = turn6CenterX + turn6Radius * Math.cos(angle)
    const z = turn6CenterZ + turn6Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 14. Straight (heading west)
  waypoints.push(new THREE.Vector3(520, groundY, -20))
  waypoints.push(new THREE.Vector3(800, groundY, -20))
  waypoints.push(new THREE.Vector3(1100, groundY, -20))
  
  // 15. Right turn - Turn 7 (90 degrees, heading south)
  const turn7Radius = 200
  const turn7CenterX = 1100
  const turn7CenterZ = -220
  for (let i = 1; i <= 12; i++) {
    const angle = Math.PI / 2 + (i / 13) * (Math.PI / 2) // 90 degrees right
    const x = turn7CenterX - turn7Radius * Math.cos(angle)
    const z = turn7CenterZ + turn7Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 16. Long straight (heading south) - approaching start/finish from behind
  waypoints.push(new THREE.Vector3(1300, groundY, -420))
  waypoints.push(new THREE.Vector3(1300, groundY, -700))
  waypoints.push(new THREE.Vector3(1300, groundY, -1000))
  waypoints.push(new THREE.Vector3(1300, groundY, -1300))
  
  // 17. Left turn - Turn 8 (90 degrees, heading east)
  const turn8Radius = 200
  const turn8CenterX = 1100
  const turn8CenterZ = -1300
  for (let i = 1; i <= 12; i++) {
    const angle = (i / 13) * (Math.PI / 2) // 90 degrees left
    const x = turn8CenterX + turn8Radius * Math.cos(angle)
    const z = turn8CenterZ + turn8Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 18. Straight (heading east)
  waypoints.push(new THREE.Vector3(1300, groundY, -1100))
  waypoints.push(new THREE.Vector3(1000, groundY, -1100))
  waypoints.push(new THREE.Vector3(700, groundY, -1100))
  waypoints.push(new THREE.Vector3(400, groundY, -1100))
  waypoints.push(new THREE.Vector3(200, groundY, -1100))
  
  // 19. Right turn - Turn 9 (90 degrees, heading north) - FINAL APPROACH
  // This brings track to approach start/finish from behind (south) heading north
  // Turn center positioned so the turn ends exactly at x=0, z=500 (south of start)
  const turn9Radius = 200
  const turn9CenterX = turn9Radius // Center at (200, 500) so turn ends at x=0, z=500
  const turn9CenterZ = 500
  for (let i = 1; i <= 12; i++) {
    const angle = -Math.PI / 2 + (i / 13) * (Math.PI / 2) // 90 degrees right
    const x = turn9CenterX - turn9Radius * Math.cos(angle)
    const z = turn9CenterZ + turn9Radius * Math.sin(angle)
    waypoints.push(new THREE.Vector3(x, groundY, z))
  }
  
  // 20. Final straight (heading north) - passes through start/finish in same direction
  // Approaches from south (positive Z), passes through (0, 0, 0), continues north (negative Z)
  // Must be exactly at x=0 to pass through start/finish line
  waypoints.push(new THREE.Vector3(0, groundY, 500))  // South of start
  waypoints.push(new THREE.Vector3(0, groundY, 400))
  waypoints.push(new THREE.Vector3(0, groundY, 300))
  waypoints.push(new THREE.Vector3(0, groundY, 200))
  waypoints.push(new THREE.Vector3(0, groundY, 100))
  waypoints.push(new THREE.Vector3(0, groundY, 50))
  
  // 21. Pass through start/finish line (0, 0, 0) heading north
  waypoints.push(new THREE.Vector3(0, groundY, 0))
  
  // 22. Continue past start/finish heading north to close the loop
  waypoints.push(new THREE.Vector3(0, groundY, -50))
  waypoints.push(new THREE.Vector3(0, groundY, -100))
  
  return waypoints
}

// COMPLETELY REWORKED TRACK GENERATION
// Single-pass approach: Generate waypoints, create one smooth curve, done

// Step 1: Generate waypoints (either from GeoJSON or manual generation)
let rawWaypoints: THREE.Vector3[]

if (USE_GEOJSON_TRACK && GEOJSON_TRACK_DATA) {
  // Use GeoJSON track data
  rawWaypoints = convertGeoJSONToWaypoints(GEOJSON_TRACK_DATA, {
    worldSize: trackRuntimeConfig.worldSize,
    coordinateElevationScale: AUSTRALIA_AUTHORED_ELEVATION_SCALE
  })
  logRacingDiagnostic(`✅ Loaded GeoJSON track with ${rawWaypoints.length} waypoints`)
} else {
  // Use manually generated track
  rawWaypoints = generateTrackWaypoints()
}

// Step 2: Clean and prepare waypoints for curve generation
const waypoints: THREE.Vector3[] = []

// Add all waypoints except duplicates
// CRITICAL: Don't skip the last point if it's the closure point - we'll handle that separately
for (let i = 0; i < rawWaypoints.length; i++) {
  const current = rawWaypoints[i]
  const isLastPoint = (i === rawWaypoints.length - 1)
  
  // Skip if this point is too close to the previous one (within 1 unit)
  // BUT: Don't skip if it's the last point and we haven't added the first point yet
  // (we need to check if last matches first after cleaning)
  if (waypoints.length > 0) {
    const prev = waypoints[waypoints.length - 1]
    const distance = current.distanceTo(prev)
    
    // Skip if too close, UNLESS it's the last point and we need to check closure
    if (distance < 1.0 && !isLastPoint) {
      continue
    }
  }
  
  waypoints.push(current.clone())
}

// Step 3: Ensure proper closure for CatmullRom closed curve
// For closed curves, the first and last points should be the same
// CRITICAL: For smooth closure, we need to ensure the curve approaches the join smoothly
const firstPoint = waypoints[0]
const lastPoint = waypoints[waypoints.length - 1]

// Check if track is already closed (within tolerance)
const closureDistance = firstPoint.distanceTo(lastPoint)
const CLOSURE_TOLERANCE = 0.1

if (closureDistance > CLOSURE_TOLERANCE) {
  // Not closed - add the first point at the end to close the loop
  waypoints.push(firstPoint.clone())
  logRacingDiagnostic(`✅ Added closing point (distance was ${closureDistance.toFixed(3)} units)`)
} else {
  // Already closed - ensure exact match for smooth join
  // Replace last point with exact copy of first to avoid any floating point differences
  waypoints[waypoints.length - 1] = firstPoint.clone()
  if (closureDistance > 0.001) {
    logRacingDiagnostic(`✅ Fixed closure point match (was ${closureDistance.toFixed(6)} units off)`)
  }
}

// CRITICAL: For smooth closure, ensure the points near the closure are well-spaced
// CatmullRom curves need good control points for smooth interpolation
// Check the spacing of the last few points before closure
if (waypoints.length >= 3) {
  const lastIdx = waypoints.length - 1
  const secondLast = waypoints[lastIdx - 1]
  const thirdLast = waypoints.length >= 4 ? waypoints[lastIdx - 2] : null
  
  // Check if the last segment before closure is too short (causes cramping)
  const lastSegmentLength = secondLast.distanceTo(firstPoint)
  const MIN_CLOSURE_SEGMENT_LENGTH = 5.0 // Minimum distance for smooth closure
  
  if (lastSegmentLength < MIN_CLOSURE_SEGMENT_LENGTH && thirdLast) {
    // Last segment is too short - this can cause cramping at closure
    // Check if we can use the second-to-last point as the closure point instead
    const secondLastToFirst = thirdLast.distanceTo(firstPoint)
    
    if (secondLastToFirst >= MIN_CLOSURE_SEGMENT_LENGTH) {
      // Remove the too-close second-to-last point and use third-to-last as closure
      waypoints.splice(lastIdx - 1, 1) // Remove second-to-last
      waypoints[waypoints.length - 1] = firstPoint.clone() // Ensure exact match
      logRacingDiagnostic(`✅ Removed too-close point near closure (was ${lastSegmentLength.toFixed(2)} units)`)
    }
  }
}

// CRITICAL: For smooth closure, ensure the curve has smooth entry/exit at the join point
// CatmullRom curves need control points before and after the join for smooth closure
// Since we're using closed=true, Three.js handles this, but we should ensure
// the waypoints near the closure are well-spaced and smooth
// Check if we need to add smoothing waypoints near the closure
const secondPoint = waypoints[1]
const secondLastPoint = waypoints[waypoints.length - 2]
const distToSecond = firstPoint.distanceTo(secondPoint)
const distToSecondLast = lastPoint.distanceTo(secondLastPoint)

// If the points near closure are too close or too far, it can cause bumpiness
// The CatmullRom curve with 'centripetal' type should handle this, but we ensure
// the closure point matches exactly
if (firstPoint.distanceTo(lastPoint) > 0.01) {
  // Force exact match for smooth closure
  waypoints[waypoints.length - 1] = firstPoint.clone()
  logRacingDiagnostic('✅ Ensured exact closure point match for smooth join')
}

// Step 4: Create single smooth curve from waypoints
// Use 'centripetal' for natural curves without overshooting
// Closed loop (true) ensures the curve connects end to start smoothly
// CRITICAL: The curve will automatically handle smooth closure since first == last
export const trackCurve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal', 0.5)

// Verify closure smoothness - check that position and tangent match at closure
const closureStart = trackCurve.getPointAt(0)
const closureEnd = trackCurve.getPointAt(1)
const closureTangentStart = trackCurve.getTangentAt(0).normalize()
const closureTangentEnd = trackCurve.getTangentAt(1).normalize()

const posDiff = closureStart.distanceTo(closureEnd)
const tangentDot = closureTangentStart.dot(closureTangentEnd)

if (posDiff > 0.01) {
  warnRacingDiagnostic(`⚠️ Track closure position mismatch: ${posDiff.toFixed(6)} units`)
} else if (tangentDot < 0.9) {
  const angleDiff = Math.acos(Math.max(-1, Math.min(1, tangentDot))) * 180 / Math.PI
  warnRacingDiagnostic(`⚠️ Track closure tangent mismatch: ${angleDiff.toFixed(1)} degrees`)
} else {
  logRacingDiagnostic(`✅ Track closure verified: position match (${posDiff.toFixed(6)} units), tangent continuity (${(tangentDot * 100).toFixed(1)}%)`)
}

export const trackLength = trackCurve.getLength()

// Find the longest straightaway and calculate start/finish line position
// This finds the midpoint of the longest straight section for the start gate
export const findStartFinishPosition = (): { position: THREE.Vector3, direction: THREE.Vector3, t: number } => {
  const pose = resolveTrackStartPose('australia', trackCurve)
  const t = pose.curveT ?? 0
  const straightLength = pose.straightLength ?? 0

  logRacingDiagnostic(`✅ Start/Finish line positioned at t=${t.toFixed(4)} (midpoint of longest straightaway, length: ${straightLength.toFixed(1)} units)`)

  return { position: pose.position, direction: pose.direction, t }
}

export const startFinishData = findStartFinishPosition()
export const startFinishPosition = startFinishData.position
export const startFinishDirection = startFinishData.direction
export const startFinishT = startFinishData.t
// PERFORMANCE: Reduced from 2000 to 900 segments - still smooth but much faster
// 900 segments = ~1 vertex per 1-2 units of track, which is sufficient for smooth appearance
export const trackSegments = 900

export const calculateTrackInterior = () => {
  const interior = calculateTrackInteriorFromCurve(trackCurve)
  logRacingDiagnostic(`🏞️ Track interior calculated: area=${interior.area.toFixed(0)}, center=(${interior.center.x.toFixed(1)}, ${interior.center.z.toFixed(1)}), size=${interior.width.toFixed(1)}x${interior.height.toFixed(1)}`)
  return interior
}

export const trackInterior = calculateTrackInterior()

// Closure verification - ensure track closes properly
const verifyClosure = () => {
  const startPos = trackCurve.getPointAt(0)
  const endPos = trackCurve.getPointAt(1)
  const startTangent = trackCurve.getTangentAt(0).normalize()
  const endTangent = trackCurve.getTangentAt(1).normalize()
  
  const posDistance = startPos.distanceTo(endPos)
  const angleDiff = Math.acos(Math.min(Math.max(startTangent.dot(endTangent), -1), 1))
  
  if (posDistance > 0.1) {
    warnRacingDiagnostic(`⚠️ Track closure position mismatch: ${posDistance.toFixed(3)} units`)
  }
  if (angleDiff > 0.1) {
    warnRacingDiagnostic(`⚠️ Track closure direction mismatch: ${(angleDiff * 180 / Math.PI).toFixed(1)} degrees`)
  }
  
  if (posDistance < 0.1 && angleDiff < 0.1) {
    logRacingDiagnostic('✅ Track closure verified: position and direction match')
  }
}

// Curvature analysis - detect tight curves and potential loops
const analyzeCurvature = () => {
  const samples = 200
  const maxCurvature = 0.1 // Maximum acceptable curvature (1/radius)
  let problemAreas: number[] = []
  
  for (let i = 0; i < samples; i++) {
    const t = i / samples
    const point = trackCurve.getPointAt(t)
    const tangent = trackCurve.getTangentAt(t).normalize()
    
    // Sample nearby points to estimate curvature
    const dt = 0.01
    const t1 = Math.max(0, t - dt)
    const t2 = Math.min(1, t + dt)
    const point1 = trackCurve.getPointAt(t1)
    const point2 = trackCurve.getPointAt(t2)
    
    // Estimate curvature using three points
    const v1 = point1.clone().sub(point)
    const v2 = point2.clone().sub(point)
    const angle = Math.acos(Math.min(Math.max(v1.normalize().dot(v2.normalize()), -1), 1))
    const avgDist = (v1.length() + v2.length()) / 2
    const curvature = angle / avgDist
    
    if (curvature > maxCurvature) {
      problemAreas.push(t)
    }
  }
  
  if (problemAreas.length > 0) {
    warnRacingDiagnostic(`⚠️ Found ${problemAreas.length} areas with high curvature (potential tight curves)`)
  } else {
    logRacingDiagnostic('✅ Curvature analysis: No problematic areas detected')
  }
}

// Verify closure and analyze curvature on initialization
verifyClosure()
analyzeCurvature()

export const trackFrames = createHorizontalTrackFrames(trackCurve, trackSegments, {
  smoothClosure: true
})


const spatialTrackIndex = createSpatialTrackIndex(trackCurve, trackRuntimeConfig.spatialIndex)
const GRID_SIZE = spatialTrackIndex.gridSize
const spatialHash = spatialTrackIndex.hash
const trackSamples = spatialTrackIndex.samples

export { spatialHash, trackSamples, GRID_SIZE }

// Performance monitoring for getTrackHeightAndInfluence
let getHeightCallCount = 0
let getHeightLastLog = Date.now()

// Simple cache for getTrackHeightAndInfluence (prevents excessive calls for same position)
const heightCache = new Map<string, { height: number, factor: number, timestamp: number }>()
const CACHE_TTL = 100 // Cache for 100ms
const CACHE_GRANULARITY = 0.5 // Cache granularity (0.5 units = same position within 0.5 units uses cache)

// Optimized getTrackHeight
// Now considers vertical distance and track position to prevent jumping to track sections above/below
// PERFORMANCE: Added caching to prevent excessive calls
export const getTrackHeightAndInfluence = (x: number, z: number, currentY?: number, trackT?: number): { height: number, factor: number } => {
    getHeightCallCount++
    const now = Date.now()
    if (now - getHeightLastLog > 5000) {
      logRacingDiagnostic(`🔍 getTrackHeightAndInfluence called ${getHeightCallCount} times in last 5s`)
      getHeightCallCount = 0
      getHeightLastLog = now
      // Clean old cache entries
      const keysToDelete: string[] = []
      heightCache.forEach((value, key) => {
        if (now - value.timestamp > CACHE_TTL) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => heightCache.delete(key))
    }
    
    // Check cache first - include trackT in cache key for better accuracy
    // PERFORMANCE: Cache even with trackT to reduce expensive calculations
    // Use rounded trackT (0.01 precision) to increase cache hits
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
      // Log when no indices found (car might be off track)
      if (getHeightCallCount % 1000 === 0) {
        warnRacingDiagnostic(`⚠️ No spatial hash indices for key=${key}, pos=(${x.toFixed(1)}, ${z.toFixed(1)})`)
      }
      return { height: 0, factor: 0 }
    }
    
    let minScore = Infinity
    let closestIndex = -1
    let fallbackIndex = -1
    let fallbackDistSq = Infinity
    
    // Maximum vertical distance to consider (prevents jumping to track far above/below)
    // Increased slightly for curves where car might be slightly above track
    const MAX_VERTICAL_DISTANCE = 40 // Increased from 30 to 40 for better curve handling
    
    // Maximum track position difference (prevents jumping to different track sections)
    // When track overlaps, only consider samples near the car's current track position
    // PERFORMANCE: Increased from 0.08 to 0.12 for smoother transitions and less constraint
    // Larger value = more lenient, allows smoother flow between sections
    const MAX_TRACK_T_DIFF = 0.12 // Increased for smoother flow (about 260 samples with 2200 total)
    
    // Find closest track sample, considering horizontal, vertical, and track position
    for (const idx of indices) {
        const sample = trackSamples[idx]
        const dx = x - sample.pos.x
        const dz = z - sample.pos.z
        const horizontalDistSq = dx*dx + dz*dz
        
        // CRITICAL: If we have track position (t), only consider samples near that position
        // This prevents jumping to overlapping track sections above/below
        if (trackT !== undefined) {
            let tDiff = Math.abs(trackT - sample.t)
            // Handle wrapping for closed loop (t=0.99 to t=0.01 is close)
            if (tDiff > 0.5) {
                tDiff = 1 - tDiff
            }
            // Skip samples that are too far along the track
            if (tDiff > MAX_TRACK_T_DIFF) {
                continue
            }
        }
        
        // Always track the closest by horizontal distance as fallback (if no trackT filter)
        if (trackT === undefined && horizontalDistSq < fallbackDistSq) {
            fallbackDistSq = horizontalDistSq
            fallbackIndex = idx
        }
        
        // If we have a current Y position, prefer track samples near that elevation
        if (currentY !== undefined) {
            const dy = Math.abs(currentY - sample.pos.y)
            
            // Skip track samples that are too far vertically
            if (dy > MAX_VERTICAL_DISTANCE) {
                continue
            }
            
            // Score combines horizontal distance, vertical distance, and track position
            // Weight vertical and track position more heavily
            const verticalWeight = 3.0 // Vertical distance is 3x more important
            const trackTWeight = trackT !== undefined ? 5.0 : 0 // Track position is 5x more important if provided
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
            // No current Y - use horizontal distance and track position
            let score = horizontalDistSq
            if (trackT !== undefined) {
                let tDiff = Math.abs(trackT - sample.t)
                if (tDiff > 0.5) tDiff = 1 - tDiff
                score += tDiff * tDiff * 10000 // Track position is very important
            }
            if (score < minScore) {
                minScore = score
                closestIndex = idx
            }
        }
    }
    
    // If no track found with currentY filtering, use fallback (closest by horizontal distance)
    if (closestIndex === -1) {
        if (fallbackIndex === -1) return { height: 0, factor: 0 }
        closestIndex = fallbackIndex
    }
    
    const sample = trackSamples[closestIndex]
    const dx = x - sample.pos.x
    const dz = z - sample.pos.z
    const dist = Math.sqrt(dx*dx + dz*dz)
    
    const result = getLegacyRoadHeightInfluence(dist, sample.pos.y, trackRuntimeConfig.roadCorridor)
    
    // Cache result - always cache to improve performance
    // PERFORMANCE: Cache even with trackT (using rounded value) to increase cache hits
    const roundedTrackTForCache = trackT !== undefined ? Math.floor(trackT * 100) / 100 : undefined
    const cacheKeyForSet = `${Math.floor(x / CACHE_GRANULARITY)},${Math.floor(z / CACHE_GRANULARITY)}${roundedTrackTForCache !== undefined ? `,t${roundedTrackTForCache.toFixed(2)}` : ''}`
    heightCache.set(cacheKeyForSet, { ...result, timestamp: now })
    
    return result
}
