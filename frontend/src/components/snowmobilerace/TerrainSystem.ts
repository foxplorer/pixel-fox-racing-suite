import { createNoise2D } from 'simplex-noise'
import * as THREE from 'three'

// Seeded random for consistent terrain
const seededRandom = (seed: number) => {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// Create noise functions with consistent seed
const TERRAIN_SEED = 42069
const rng = seededRandom(TERRAIN_SEED)
const noise2D = createNoise2D(rng)

// Secondary noise for detail
const rng2 = seededRandom(TERRAIN_SEED + 1)
const detailNoise2D = createNoise2D(rng2)

// Terrain configuration - tuned for fun snowmobiling with smooth rolling hills
export const TERRAIN_CONFIG = {
  // Main rolling hills - smooth and gentle
  primaryScale: 0.002,      // Lower frequency = larger, smoother hills
  primaryAmplitude: 22,     // Max hill height (meters)

  // Medium undulations - reduced for smoother feel
  secondaryScale: 0.008,    // Lower frequency
  secondaryAmplitude: 3,    // Much gentler medium bumps

  // Small terrain detail - subtle
  detailScale: 0.025,       // Lower frequency for smoother surface
  detailAmplitude: 0.6,     // Very subtle surface texture

  // Micro roughness - minimal for fluffy powder feel
  microScale: 0.08,
  microAmplitude: 0.15,

  // Flat area around spawn
  flatRadius: 50,           // Larger flat spawn area
  flatFalloff: 40,          // Gentler transition to hills
}

// ========== TERRAIN HEIGHT CACHE ==========
// Simple grid-based cache for terrain height lookups
// Quantizes positions to 0.5 unit grid for cache hits
const CACHE_GRID_SIZE = 0.5
const CACHE_MAX_SIZE = 2000  // Max cached positions
const heightCache = new Map<string, number>()
const ASPEN_START_PAD = {
  centerX: -640.3879507689741,
  centerZ: 625.846283227357,
  dirX: 0.994857941327586,
  dirZ: 0.09982762707040632,
  halfLength: 95,
  halfWidth: 135,
  blend: 45
}

const startPadPerpX = -ASPEN_START_PAD.dirZ
const startPadPerpZ = ASPEN_START_PAD.dirX

const getCacheKey = (x: number, z: number): string => {
  // Quantize to grid for cache hits on nearby lookups
  const qx = Math.round(x / CACHE_GRID_SIZE) * CACHE_GRID_SIZE
  const qz = Math.round(z / CACHE_GRID_SIZE) * CACHE_GRID_SIZE
  return `${qx},${qz}`
}

const smoothstep = (value: number): number => {
  const t = Math.min(Math.max(value, 0), 1)
  return t * t * (3 - 2 * t)
}

const getRawTerrainHeight = (x: number, z: number): number => {
  const cfg = TERRAIN_CONFIG

  // Distance from origin for spawn area flattening
  const distFromOrigin = Math.sqrt(x * x + z * z)

  // Flatten factor: 0 at origin, 1 at full hills
  let flattenFactor = 1
  if (distFromOrigin < cfg.flatRadius) {
    flattenFactor = 0
  } else if (distFromOrigin < cfg.flatRadius + cfg.flatFalloff) {
    const t = (distFromOrigin - cfg.flatRadius) / cfg.flatFalloff
    flattenFactor = smoothstep(t)
  }

  // Layer multiple noise octaves for natural terrain
  const primary = noise2D(x * cfg.primaryScale, z * cfg.primaryScale) * cfg.primaryAmplitude
  const secondary = noise2D(x * cfg.secondaryScale, z * cfg.secondaryScale) * cfg.secondaryAmplitude
  const detail = detailNoise2D(x * cfg.detailScale, z * cfg.detailScale) * cfg.detailAmplitude
  const micro = detailNoise2D(x * cfg.microScale, z * cfg.microScale) * cfg.microAmplitude

  return (primary + secondary + detail + micro) * flattenFactor
}

const applyStartPadFlattening = (x: number, z: number, terrainHeight: number): number => {
  const dx = x - ASPEN_START_PAD.centerX
  const dz = z - ASPEN_START_PAD.centerZ
  const localAlong = dx * ASPEN_START_PAD.dirX + dz * ASPEN_START_PAD.dirZ
  const localAcross = dx * startPadPerpX + dz * startPadPerpZ
  const edgeDistance = Math.max(
    Math.abs(localAlong) - ASPEN_START_PAD.halfLength,
    Math.abs(localAcross) - ASPEN_START_PAD.halfWidth
  )

  if (edgeDistance >= ASPEN_START_PAD.blend) return terrainHeight

  const padHeight = getRawTerrainHeight(ASPEN_START_PAD.centerX, ASPEN_START_PAD.centerZ)
  if (edgeDistance <= 0) return padHeight

  const terrainInfluence = smoothstep(edgeDistance / ASPEN_START_PAD.blend)
  return padHeight * (1 - terrainInfluence) + terrainHeight * terrainInfluence
}

/**
 * Get terrain height at any world position
 * Optimized with caching for frequent calls (physics, tree placement)
 */
export const getTerrainHeight = (x: number, z: number): number => {
  // Check cache first
  const cacheKey = getCacheKey(x, z)
  const cached = heightCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const height = applyStartPadFlattening(x, z, getRawTerrainHeight(x, z))

  // Store in cache (with size limit)
  if (heightCache.size >= CACHE_MAX_SIZE) {
    // Clear oldest entries (simple strategy - clear half)
    const entries = Array.from(heightCache.keys())
    for (let i = 0; i < CACHE_MAX_SIZE / 2; i++) {
      heightCache.delete(entries[i])
    }
  }
  heightCache.set(cacheKey, height)

  return height
}

// Reusable vectors for normal calculations (avoid GC pressure)
const _normalVec = new THREE.Vector3()
const _physicsNormalVec = new THREE.Vector3()

/**
 * Get terrain normal (slope direction) at a position
 * Used for physics calculations
 */
export const getTerrainNormal = (x: number, z: number): THREE.Vector3 => {
  const delta = 0.5 // Sample distance

  // Sample heights in a cross pattern (cached lookups)
  const hLeft = getTerrainHeight(x - delta, z)
  const hRight = getTerrainHeight(x + delta, z)
  const hBack = getTerrainHeight(x, z - delta)
  const hFront = getTerrainHeight(x, z + delta)

  // Calculate normal from height differences using reusable vector
  // Normal = normalize(cross(tangentX, tangentZ))
  _normalVec.set(
    (hLeft - hRight) / (2 * delta),
    1,
    (hBack - hFront) / (2 * delta)
  )

  return _normalVec.normalize()
}

/**
 * Get slope angle in a specific direction (for physics)
 * Returns angle in radians, positive = uphill, negative = downhill
 */
export const getSlopeAngleInDirection = (
  x: number,
  z: number,
  directionX: number,
  directionZ: number
): number => {
  const normal = getTerrainNormal(x, z)

  // Project normal onto the movement plane
  // The slope angle is the angle between the normal and vertical
  const up = new THREE.Vector3(0, 1, 0)

  // Direction vector (normalized, in XZ plane)
  const dir = new THREE.Vector3(directionX, 0, directionZ).normalize()

  // Calculate the slope component in the movement direction
  // Dot product of normal with horizontal direction gives slope
  const slopeInDir = -(normal.x * dir.x + normal.z * dir.z)

  return Math.atan(slopeInDir)
}

/**
 * Get cross-slope angle (perpendicular to movement direction)
 * Used for sled lean/tilt on sidehills
 */
export const getCrossSlopeAngle = (
  x: number,
  z: number,
  forwardX: number,
  forwardZ: number
): number => {
  const normal = getTerrainNormal(x, z)

  // Right vector (perpendicular to forward in XZ plane)
  const rightX = -forwardZ
  const rightZ = forwardX
  const len = Math.sqrt(rightX * rightX + rightZ * rightZ)

  if (len < 0.001) return 0

  // Slope component perpendicular to movement
  const crossSlope = -(normal.x * rightX / len + normal.z * rightZ / len)

  return Math.atan(crossSlope)
}

/**
 * Get terrain data for physics in one call (optimized)
 * Returns height, forward slope, and cross slope
 * Uses reusable vector to avoid GC pressure
 */
export const getTerrainPhysicsData = (
  x: number,
  z: number,
  forwardX: number,
  forwardZ: number
): {
  height: number
  forwardSlope: number  // Positive = uphill
  crossSlope: number    // Positive = tilting right
  normal: THREE.Vector3
} => {
  const delta = 0.5

  // Sample heights (cached lookups)
  const hCenter = getTerrainHeight(x, z)
  const hLeft = getTerrainHeight(x - delta, z)
  const hRight = getTerrainHeight(x + delta, z)
  const hBack = getTerrainHeight(x, z - delta)
  const hFront = getTerrainHeight(x, z + delta)

  // Calculate normal using reusable vector
  _physicsNormalVec.set(
    (hLeft - hRight) / (2 * delta),
    1,
    (hBack - hFront) / (2 * delta)
  ).normalize()

  // Normalize forward direction
  const fwdLen = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ)
  if (fwdLen < 0.001) {
    return { height: hCenter, forwardSlope: 0, crossSlope: 0, normal: _physicsNormalVec }
  }

  const fwdNormX = forwardX / fwdLen
  const fwdNormZ = forwardZ / fwdLen

  // Right vector (perpendicular)
  const rightX = -fwdNormZ
  const rightZ = fwdNormX

  // Forward slope (negative normal dot forward = uphill)
  const forwardSlope = Math.atan(-(_physicsNormalVec.x * fwdNormX + _physicsNormalVec.z * fwdNormZ))

  // Cross slope (negative normal dot right = tilt right)
  const crossSlope = Math.atan(-(_physicsNormalVec.x * rightX + _physicsNormalVec.z * rightZ))

  return { height: hCenter, forwardSlope, crossSlope, normal: _physicsNormalVec }
}

// Terrain mesh segment size and resolution
export const TERRAIN_SEGMENT_SIZE = 400  // Size of each terrain chunk (larger = fewer chunks)
export const TERRAIN_RESOLUTION = 80      // Vertices per side (performance tuned)
export const TERRAIN_RENDER_DISTANCE = 2000 // How far terrain extends

/**
 * Generate terrain geometry vertices for a chunk
 * Used by the terrain mesh component
 */
export const generateTerrainChunkGeometry = (
  offsetX: number,
  offsetZ: number,
  size: number = TERRAIN_SEGMENT_SIZE,
  resolution: number = TERRAIN_RESOLUTION
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } => {
  const vertexCount = resolution * resolution
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)

  const step = size / (resolution - 1)

  // Generate vertices
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const idx = (j * resolution + i) * 3
      const x = offsetX + i * step - size / 2
      const z = offsetZ + j * step - size / 2
      const y = getTerrainHeight(x, z)

      positions[idx] = x
      positions[idx + 1] = y
      positions[idx + 2] = z

      // Calculate normal
      const normal = getTerrainNormal(x, z)
      normals[idx] = normal.x
      normals[idx + 1] = normal.y
      normals[idx + 2] = normal.z
    }
  }

  // Generate indices for triangles
  const indexCount = (resolution - 1) * (resolution - 1) * 6
  const indices = new Uint32Array(indexCount)
  let indexIdx = 0

  for (let j = 0; j < resolution - 1; j++) {
    for (let i = 0; i < resolution - 1; i++) {
      const topLeft = j * resolution + i
      const topRight = topLeft + 1
      const bottomLeft = (j + 1) * resolution + i
      const bottomRight = bottomLeft + 1

      // First triangle
      indices[indexIdx++] = topLeft
      indices[indexIdx++] = bottomLeft
      indices[indexIdx++] = topRight

      // Second triangle
      indices[indexIdx++] = topRight
      indices[indexIdx++] = bottomLeft
      indices[indexIdx++] = bottomRight
    }
  }

  return { positions, normals, indices }
}
