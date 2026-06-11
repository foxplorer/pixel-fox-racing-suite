import * as THREE from 'three'
import { SeededRandom } from '../../../core/seededRandom'
import { getQualityScaledCount } from '../../../performance/sceneryQuality'
import type { RacingQualityPreset } from '../../../performance/qualitySettings'

export interface UnitedKingdomTreePlacement {
  x: number
  z: number
  scale: number
  radius: number
}

export interface UnitedKingdomAdvertisingBoard {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  offset: number
  side: 'left' | 'right'
  height: number
}

export interface UnitedKingdomAdvertisingLogoDecal {
  curve: THREE.CatmullRomCurve3
  t: number
  offset: number
  side: 'left' | 'right'
  width: number
  height: number
  boardHeight: number
  face: 'track' | 'outer'
  logo: 'pixel-racing' | 'your-ad-here'
}

const UNITED_KINGDOM_BASE_TREE_COUNT = 120
const UNITED_KINGDOM_TREE_SEED = 1948
const UNITED_KINGDOM_BOARD_OFFSET = 26
const UNITED_KINGDOM_BOARD_HEIGHT = 3.5
const UNITED_KINGDOM_BOARD_SEGMENTS = 8
const UNITED_KINGDOM_BOARD_DECAL_SPACING = 46
const UNITED_KINGDOM_BOARD_DECAL_WIDTH = 6.5
const UNITED_KINGDOM_BOARD_DECAL_HEIGHT = 1.5
const UNITED_KINGDOM_BOARD_DECAL_CURVE_SAMPLE_SPAN = 0.006
const UNITED_KINGDOM_BOARD_DECAL_MIN_TANGENT_DOT = 0.985
const UNITED_KINGDOM_MIN_TREE_CENTERLINE_DISTANCE = 70

const pushTreeOutsideTrackClearance = (
  trackCurve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
  minDistance: number
): { x: number; z: number } => {
  let nextX = x
  let nextZ = z

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

    if (!nearestPoint || nearestDistanceSq >= minDistance * minDistance) {
      return { x: nextX, z: nextZ }
    }

    const distance = Math.sqrt(nearestDistanceSq)
    const pushDirection = distance > 0.001
      ? new THREE.Vector3(nextX - nearestPoint.x, 0, nextZ - nearestPoint.z).normalize()
      : trackCurve.getTangentAt(0).cross(new THREE.Vector3(0, 1, 0)).normalize()

    nextX = nearestPoint.x + pushDirection.x * minDistance
    nextZ = nearestPoint.z + pushDirection.z * minDistance
  }

  return { x: nextX, z: nextZ }
}

export const createUnitedKingdomTreePlacements = (
  trackCurve: THREE.CatmullRomCurve3,
  qualityPreset: RacingQualityPreset
): UnitedKingdomTreePlacement[] => {
  const count = getQualityScaledCount(UNITED_KINGDOM_BASE_TREE_COUNT, qualityPreset, 40)
  const rng = new SeededRandom(UNITED_KINGDOM_TREE_SEED + count)
  const trees: UnitedKingdomTreePlacement[] = []

  for (let i = 0; i < count; i++) {
    const t = (i / count + rng.next() * 0.015) % 1
    const point = trackCurve.getPointAt(t)
    const tangent = trackCurve.getTangentAt(t).normalize()
    const right = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
    const side = rng.next() < 0.5 ? -1 : 1
    const distance = 130 + rng.next() * 160
    const lateral = right.multiplyScalar(side * distance)
    const along = tangent.multiplyScalar((rng.next() - 0.5) * 20)
    const scale = 0.65 + rng.next() * 0.75
    const placement = pushTreeOutsideTrackClearance(
      trackCurve,
      point.x + lateral.x + along.x,
      point.z + lateral.z + along.z,
      UNITED_KINGDOM_MIN_TREE_CENTERLINE_DISTANCE
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

export const createUnitedKingdomAdvertisingBoards = (
  trackCurve: THREE.CatmullRomCurve3
): UnitedKingdomAdvertisingBoard[] => {
  const boards: UnitedKingdomAdvertisingBoard[] = []

  for (let i = 0; i < UNITED_KINGDOM_BOARD_SEGMENTS; i++) {
    const startT = i / UNITED_KINGDOM_BOARD_SEGMENTS
    const endT = (i + 1) / UNITED_KINGDOM_BOARD_SEGMENTS

    boards.push({
      curve: trackCurve,
      startT,
      endT,
      offset: UNITED_KINGDOM_BOARD_OFFSET,
      side: 'left',
      height: UNITED_KINGDOM_BOARD_HEIGHT
    })
    boards.push({
      curve: trackCurve,
      startT,
      endT,
      offset: UNITED_KINGDOM_BOARD_OFFSET,
      side: 'right',
      height: UNITED_KINGDOM_BOARD_HEIGHT
    })
  }

  return boards
}

const getWrappedT = (t: number): number => ((t % 1) + 1) % 1

const estimateCurveSectionLength = (
  curve: THREE.CatmullRomCurve3,
  startT: number,
  endT: number,
  samples = 24
): number => {
  let length = 0

  for (let i = 0; i < samples; i++) {
    const segmentStart = startT + (endT - startT) * (i / samples)
    const segmentEnd = startT + (endT - startT) * ((i + 1) / samples)
    const p1 = curve.getPointAt(getWrappedT(segmentStart))
    const p2 = curve.getPointAt(getWrappedT(segmentEnd))
    length += p1.distanceTo(p2)
  }

  return length
}

export const isUnitedKingdomAdvertisingLogoDecalAllowed = (
  curve: THREE.CatmullRomCurve3,
  t: number,
  sampleSpan = UNITED_KINGDOM_BOARD_DECAL_CURVE_SAMPLE_SPAN,
  minTangentDot = UNITED_KINGDOM_BOARD_DECAL_MIN_TANGENT_DOT
): boolean => {
  const tangentBefore = curve.getTangentAt(getWrappedT(t - sampleSpan)).normalize()
  const tangentCenter = curve.getTangentAt(getWrappedT(t)).normalize()
  const tangentAfter = curve.getTangentAt(getWrappedT(t + sampleSpan)).normalize()

  return (
    tangentCenter.dot(tangentBefore) >= minTangentDot &&
    tangentCenter.dot(tangentAfter) >= minTangentDot &&
    tangentBefore.dot(tangentAfter) >= minTangentDot
  )
}

export const createUnitedKingdomAdvertisingLogoDecals = (
  boards: UnitedKingdomAdvertisingBoard[]
): UnitedKingdomAdvertisingLogoDecal[] => {
  const decals: UnitedKingdomAdvertisingLogoDecal[] = []

  boards.forEach((board, boardIndex) => {
    const boardLength = estimateCurveSectionLength(board.curve, board.startT, board.endT)
    const decalCount = Math.max(1, Math.floor(boardLength / UNITED_KINGDOM_BOARD_DECAL_SPACING))

    for (let i = 0; i < decalCount; i++) {
      const localT = (i + 0.5) / decalCount
      const logo = (boardIndex + i) % 3 === 0 ? 'your-ad-here' : 'pixel-racing'
      const t = getWrappedT(board.startT + (board.endT - board.startT) * localT)

      if (!isUnitedKingdomAdvertisingLogoDecalAllowed(board.curve, t)) {
        continue
      }

      ;(['track'] as const).forEach(face => {
        decals.push({
          curve: board.curve,
          t,
          offset: board.offset,
          side: board.side,
          width: UNITED_KINGDOM_BOARD_DECAL_WIDTH,
          height: UNITED_KINGDOM_BOARD_DECAL_HEIGHT,
          boardHeight: board.height,
          face,
          logo
        })
      })
    }
  })

  return decals
}
