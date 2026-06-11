import * as THREE from 'three'
import { SeededRandom } from '../../core/seededRandom'
import { getQualityScaledCount } from '../../performance/sceneryQuality'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import type {
  ImportedSceneryAdvertisingBoard,
  ImportedSceneryTreePlacement
} from './ImportedCarTrackScenery'

export interface ImportedBasicTreeOptions {
  baseCount?: number
  minimumCount?: number
  seed?: number
  minCenterlineDistance?: number
  minDistanceFromTrack?: number
  maxDistanceFromTrack?: number
  alongJitter?: number
  minScale?: number
  maxScale?: number
}

export interface ImportedBasicBoardOptions {
  offset?: number
  height?: number
  segments?: number
  excludedRanges?: Array<readonly [number, number]>
}

const DEFAULT_TREE_OPTIONS = {
  baseCount: 100,
  minimumCount: 30,
  seed: 7001,
  minCenterlineDistance: 62,
  minDistanceFromTrack: 105,
  maxDistanceFromTrack: 240,
  alongJitter: 18,
  minScale: 0.6,
  maxScale: 1.3
} satisfies Required<ImportedBasicTreeOptions>

const DEFAULT_BOARD_OPTIONS = {
  offset: 26,
  height: 3.5,
  segments: 8,
  excludedRanges: []
} satisfies {
  offset: number
  height: number
  segments: number
  excludedRanges: Array<readonly [number, number]>
}

const isRangeExcluded = (
  startT: number,
  endT: number,
  excludedRanges: Array<readonly [number, number]>
): boolean => {
  return excludedRanges.some(([excludedStart, excludedEnd]) => {
    if (excludedStart <= excludedEnd) {
      return startT < excludedEnd && endT > excludedStart
    }

    return startT < excludedEnd || endT > excludedStart
  })
}

const pushOutsideTrackClearance = (
  trackCurve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
  minDistance: number
): { x: number; z: number } => {
  let nextX = x
  let nextZ = z
  const clearanceDistance = minDistance + 0.05

  for (let attempt = 0; attempt < 5; attempt++) {
    let nearestPoint: THREE.Vector3 | null = null
    let nearestDistanceSq = Infinity

    for (let i = 0; i <= 360; i++) {
      const point = trackCurve.getPointAt(i / 360)
      const dx = nextX - point.x
      const dz = nextZ - point.z
      const distanceSq = dx * dx + dz * dz

      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearestPoint = point
      }
    }

    if (!nearestPoint || nearestDistanceSq >= clearanceDistance * clearanceDistance) {
      return { x: nextX, z: nextZ }
    }

    const distance = Math.sqrt(nearestDistanceSq)
    const pushDirection = distance > 0.001
      ? new THREE.Vector3(nextX - nearestPoint.x, 0, nextZ - nearestPoint.z).normalize()
      : trackCurve.getTangentAt(0).cross(new THREE.Vector3(0, 1, 0)).normalize()

    nextX = nearestPoint.x + pushDirection.x * clearanceDistance
    nextZ = nearestPoint.z + pushDirection.z * clearanceDistance
  }

  return { x: nextX, z: nextZ }
}

export const createImportedBasicTreePlacements = (
  trackCurve: THREE.CatmullRomCurve3,
  qualityPreset: RacingQualityPreset,
  options: ImportedBasicTreeOptions = {}
): ImportedSceneryTreePlacement[] => {
  const resolved = {
    ...DEFAULT_TREE_OPTIONS,
    ...options
  }
  const count = getQualityScaledCount(resolved.baseCount, qualityPreset, resolved.minimumCount)
  const rng = new SeededRandom(resolved.seed + count)
  const trees: ImportedSceneryTreePlacement[] = []

  for (let i = 0; i < count; i++) {
    const t = (i / count + rng.next() * 0.015) % 1
    const point = trackCurve.getPointAt(t)
    const tangent = trackCurve.getTangentAt(t).normalize()
    const right = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
    const side = rng.next() < 0.5 ? -1 : 1
    const distance = resolved.minDistanceFromTrack +
      rng.next() * Math.max(0, resolved.maxDistanceFromTrack - resolved.minDistanceFromTrack)
    const lateral = right.multiplyScalar(side * distance)
    const along = tangent.multiplyScalar((rng.next() - 0.5) * resolved.alongJitter)
    const scale = resolved.minScale + rng.next() * Math.max(0, resolved.maxScale - resolved.minScale)
    const placement = pushOutsideTrackClearance(
      trackCurve,
      point.x + lateral.x + along.x,
      point.z + lateral.z + along.z,
      resolved.minCenterlineDistance
    )

    trees.push({
      x: placement.x,
      z: placement.z,
      scale,
      radius: 0.5 * scale + 0.3
    })
  }

  return trees
}

export const createImportedBasicAdvertisingBoards = (
  trackCurve: THREE.CatmullRomCurve3,
  options: ImportedBasicBoardOptions = {}
): ImportedSceneryAdvertisingBoard[] => {
  const resolved = {
    ...DEFAULT_BOARD_OPTIONS,
    ...options
  }
  const boards: ImportedSceneryAdvertisingBoard[] = []

  for (let i = 0; i < resolved.segments; i++) {
    const startT = i / resolved.segments
    const endT = (i + 1) / resolved.segments

    if (isRangeExcluded(startT, endT, resolved.excludedRanges)) {
      continue
    }

    boards.push({
      curve: trackCurve,
      startT,
      endT,
      offset: resolved.offset,
      side: 'left',
      height: resolved.height
    })
    boards.push({
      curve: trackCurve,
      startT,
      endT,
      offset: resolved.offset,
      side: 'right',
      height: resolved.height
    })
  }

  return boards
}
