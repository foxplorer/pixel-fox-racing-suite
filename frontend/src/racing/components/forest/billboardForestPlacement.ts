import * as THREE from 'three'
import { SeededRandom } from '../../core/seededRandom'
import { getQualityScaledCount } from '../../performance/sceneryQuality'
import type { RacingQualityPreset } from '../../performance/qualitySettings'

export interface BillboardTreePlacement {
  x: number
  z: number
  height: number
  variant: number
  phase: number
}

export interface ForestExclusionZone {
  x: number
  z: number
  radius: number
}

export interface BillboardForestOptions {
  baseCount?: number
  minimumCount?: number
  variantCount?: number
  seed?: number
  minDistanceFromTrack?: number
  maxDistanceFromTrack?: number
  minHeight?: number
  maxHeight?: number
  edgeBias?: number
  minTrackClearance?: number
  exclusionZones?: ForestExclusionZone[]
  trackSamples?: number
}

const DEFAULTS = {
  // Quality scaling produces approximately 1,375 / 2,000 / 2,500 trees for
  // Low / Medium / High. The billboard cards are large enough that the former
  // 5,500 / 8,000 / 10,000 counts made the forest read as an opaque wall.
  baseCount: 2500,
  minimumCount: 700,
  variantCount: 6,
  seed: 41000,
  minDistanceFromTrack: 46,
  maxDistanceFromTrack: 460,
  minHeight: 28,
  maxHeight: 64,
  edgeBias: 2.4,
  trackSamples: 240
}

const MAX_ATTEMPTS_PER_TREE = 6

export const createBillboardForestPlacements = (
  trackCurve: THREE.CatmullRomCurve3,
  qualityPreset: RacingQualityPreset,
  options: BillboardForestOptions = {}
): BillboardTreePlacement[] => {
  const resolved = { ...DEFAULTS, ...options }
  const count = getQualityScaledCount(resolved.baseCount, qualityPreset, resolved.minimumCount)
  const rng = new SeededRandom(resolved.seed + count)
  const placements: BillboardTreePlacement[] = []
  const clearance = options.minTrackClearance ?? resolved.minDistanceFromTrack
  const clearanceSq = clearance * clearance
  const exclusionZones = options.exclusionZones ?? []
  const span = Math.max(0, resolved.maxDistanceFromTrack - resolved.minDistanceFromTrack)
  const trackPoints: THREE.Vector3[] = []

  for (let i = 0; i <= resolved.trackSamples; i++) {
    trackPoints.push(trackCurve.getPointAt(i / resolved.trackSamples))
  }

  const isClear = (x: number, z: number): boolean => {
    for (const point of trackPoints) {
      const dx = x - point.x
      const dz = z - point.z
      if (dx * dx + dz * dz < clearanceSq) return false
    }
    for (const zone of exclusionZones) {
      const dx = x - zone.x
      const dz = z - zone.z
      if (dx * dx + dz * dz < zone.radius * zone.radius) return false
    }
    return true
  }

  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const point = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TREE; attempt++) {
      const t = attempt === 0 ? (i + rng.next()) / count : rng.next()
      trackCurve.getPointAt(t % 1, point)
      trackCurve.getTangentAt(t % 1, tangent).normalize()
      right.copy(up).cross(tangent).normalize()

      const side = rng.next() < 0.5 ? -1 : 1
      const depthT = Math.pow(rng.next(), resolved.edgeBias)
      const distance = resolved.minDistanceFromTrack + depthT * span
      const along = (rng.next() - 0.5) * 28
      const x = point.x + right.x * side * distance + tangent.x * along
      const z = point.z + right.z * side * distance + tangent.z * along

      if (!isClear(x, z)) continue

      const heightT = rng.next() * 0.7 + depthT * 0.3
      placements.push({
        x,
        z,
        height: resolved.minHeight + heightT * (resolved.maxHeight - resolved.minHeight),
        variant: Math.floor(rng.next() * resolved.variantCount),
        phase: rng.next() * Math.PI * 2
      })
      break
    }
  }

  return placements
}
