import * as THREE from 'three'

export type TrackSample = {
  pos: THREE.Vector3
  dist: number
  t: number
}

export type SpatialTrackIndex = {
  gridSize: number
  samples: TrackSample[]
  hash: Map<string, number[]>
}

export type CreateSpatialTrackIndexOptions = {
  samples?: number
  gridSize?: number
  getY?: (x: number, z: number, point: THREE.Vector3, t: number) => number
}

export const DEFAULT_SPATIAL_TRACK_INDEX_SAMPLES = 2200
export const DEFAULT_SPATIAL_TRACK_INDEX_GRID_SIZE = 50

export const createSpatialTrackIndex = (
  trackCurve: THREE.CatmullRomCurve3,
  options: CreateSpatialTrackIndexOptions = {}
): SpatialTrackIndex => {
  const sampleCount = options.samples ?? DEFAULT_SPATIAL_TRACK_INDEX_SAMPLES
  const gridSize = options.gridSize ?? DEFAULT_SPATIAL_TRACK_INDEX_GRID_SIZE
  const samplePoints = trackCurve.getSpacedPoints(sampleCount)
  const totalLength = trackCurve.getLength()
  const samples: TrackSample[] = []

  for (let i = 0; i < samplePoints.length; i++) {
    const t = i / (samplePoints.length - 1)
    const pos = samplePoints[i].clone()

    if (options.getY) {
      pos.y = options.getY(pos.x, pos.z, pos, t)
    }

    samples.push({ pos, dist: t * totalLength, t })
  }

  const hash: Map<string, number[]> = new Map()

  samples.forEach((sample, index) => {
    const gx = Math.floor(sample.pos.x / gridSize)
    const gz = Math.floor(sample.pos.z / gridSize)

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${gx + i},${gz + j}`
        if (!hash.has(key)) hash.set(key, [])
        hash.get(key)?.push(index)
      }
    }
  })

  return { gridSize, samples, hash }
}

export const getSpatialHashKey = (x: number, z: number, gridSize: number): string => {
  const gx = Math.floor(x / gridSize)
  const gz = Math.floor(z / gridSize)
  return `${gx},${gz}`
}

export const findNearestTrackSample = (
  index: SpatialTrackIndex,
  x: number,
  z: number
): { sample: TrackSample | null; distanceSq: number } => {
  const key = getSpatialHashKey(x, z, index.gridSize)
  const indices = index.hash.get(key)

  if (!indices || indices.length === 0) {
    return { sample: null, distanceSq: Infinity }
  }

  let bestSample: TrackSample | null = null
  let bestDistanceSq = Infinity

  for (const idx of indices) {
    const sample = index.samples[idx]
    const dx = x - sample.pos.x
    const dz = z - sample.pos.z
    const distanceSq = dx * dx + dz * dz

    if (distanceSq < bestDistanceSq) {
      bestSample = sample
      bestDistanceSq = distanceSq
    }
  }

  return { sample: bestSample, distanceSq: bestDistanceSq }
}

export const isWithinTrackDistance = (
  index: SpatialTrackIndex,
  x: number,
  z: number,
  maxDistance: number
): boolean => {
  const { distanceSq } = findNearestTrackSample(index, x, z)
  return distanceSq <= maxDistance * maxDistance
}

export const findIndexedTrackPositionT = (
  index: SpatialTrackIndex,
  trackCurve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
  options: {
    coarseSamples?: number
    refineSamples?: number
  } = {}
): number => {
  const { sample } = findNearestTrackSample(index, x, z)
  if (sample) return sample.t

  return findClosestCurveT(trackCurve, x, z, {
    coarseSamples: options.coarseSamples ?? 20,
    refineSamples: options.refineSamples ?? 0
  }).t
}

export const findClosestCurveT = (
  trackCurve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
  options: {
    coarseSamples?: number
    refineSamples?: number
    refineRangeMultiplier?: number
  } = {}
): { t: number; distanceSq: number } => {
  const coarseSamples = options.coarseSamples ?? 200
  const refineSamples = options.refineSamples ?? 50
  const refineRange = (options.refineRangeMultiplier ?? 2) / coarseSamples
  const point = new THREE.Vector3()
  let bestT = 0
  let bestDistanceSq = Infinity

  for (let i = 0; i <= coarseSamples; i++) {
    const t = i / coarseSamples
    trackCurve.getPointAt(t, point)
    const dx = x - point.x
    const dz = z - point.z
    const distanceSq = dx * dx + dz * dz

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestT = t
    }
  }

  if (refineSamples > 0) {
    for (let i = 0; i <= refineSamples; i++) {
      const offset = (i / refineSamples - 0.5) * refineRange
      let t = bestT + offset
      if (t < 0) t += 1
      if (t > 1) t -= 1
      t = Math.max(0, Math.min(1, t))

      trackCurve.getPointAt(t, point)
      const dx = x - point.x
      const dz = z - point.z
      const distanceSq = dx * dx + dz * dz

      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq
        bestT = t
      }
    }
  }

  return { t: bestT, distanceSq: bestDistanceSq }
}
