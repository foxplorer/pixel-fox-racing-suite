import * as THREE from 'three'
import {
  getCarBoardPushDistance,
  getCarBoardShapeCollisionDistance,
  type CarHandlingConfig
} from './carHandling'

export interface RacingAdvertisingBoard {
  curve: THREE.CatmullRomCurve3
  startT: number
  endT: number
  offset: number
  side: 'left' | 'right'
  height: number
}

export interface CarBoardCollisionScratch {
  curvePoint: THREE.Vector3
  curveTangent: THREE.Vector3
  perpDir: THREE.Vector3
  offsetDir: THREE.Vector3
  boardMidPoint: THREE.Vector3
  boardPoint: THREE.Vector3
  prevBoardPoint: THREE.Vector3
  nearestPoint: THREE.Vector3
  nearestOffsetDir?: THREE.Vector3
  pushDirection: THREE.Vector3
}

export interface ResolveCarAdvertisingBoardCollisionOptions {
  position: THREE.Vector3
  boards: RacingAdvertisingBoard[]
  carRadius: number
  carForward?: THREE.Vector3
  boardTangent: THREE.Vector3
  scratch: CarBoardCollisionScratch
  handling?: CarHandlingConfig
  samples?: number
}

export interface CarAdvertisingBoardCollisionResult {
  collided: boolean
}

const wrapClosedCurveT = (t: number): number => {
  if (t < 0) return t + 1
  if (t > 1) return t - 1
  return t
}

export const resolveCarAdvertisingBoardCollision = ({
  position,
  boards,
  carRadius,
  carForward,
  boardTangent,
  scratch,
  handling,
  samples = 50
}: ResolveCarAdvertisingBoardCollisionOptions): CarAdvertisingBoardCollisionResult => {
  if (boards.length === 0) {
    return { collided: false }
  }

  for (const board of boards) {
    const midT = (board.startT + board.endT) / 2
    const wrappedMidT = wrapClosedCurveT(midT)
    board.curve.getPointAt(wrappedMidT, scratch.curvePoint)
    board.curve.getTangentAt(wrappedMidT, scratch.curveTangent)
    scratch.curveTangent.normalize()

    scratch.perpDir.set(-scratch.curveTangent.z, 0, scratch.curveTangent.x).normalize()
    scratch.offsetDir.copy(scratch.perpDir)
    if (board.side === 'right') {
      scratch.offsetDir.multiplyScalar(-1)
    }

    scratch.boardMidPoint.copy(scratch.curvePoint).addScaledVector(scratch.offsetDir, board.offset)

    const dx = position.x - scratch.boardMidPoint.x
    const dz = position.z - scratch.boardMidPoint.z
    const quickDistSq = dx * dx + dz * dz
    const boardLength = board.curve.getLength() * Math.abs(board.endT - board.startT)
    const maxCheckDistance = boardLength / 2 + board.offset + carRadius + 5
    if (quickDistSq > maxCheckDistance * maxCheckDistance) {
      continue
    }

    let minDistanceSq = Infinity
    let nearestT = board.startT
    let hasPrevPoint = false
    let nearestOffsetDirX = 0
    let nearestOffsetDirZ = 0

    for (let i = 0; i <= samples; i++) {
      const t = board.startT + (board.endT - board.startT) * (i / samples)
      const wrappedT = wrapClosedCurveT(t)

      board.curve.getPointAt(wrappedT, scratch.curvePoint)
      board.curve.getTangentAt(wrappedT, scratch.curveTangent)
      scratch.curveTangent.normalize()

      scratch.perpDir.set(-scratch.curveTangent.z, 0, scratch.curveTangent.x).normalize()
      scratch.offsetDir.copy(scratch.perpDir)
      if (board.side === 'right') {
        scratch.offsetDir.multiplyScalar(-1)
      }

      scratch.boardPoint.copy(scratch.curvePoint).addScaledVector(scratch.offsetDir, board.offset)

      const boardDx = position.x - scratch.boardPoint.x
      const boardDz = position.z - scratch.boardPoint.z
      const distanceSq = boardDx * boardDx + boardDz * boardDz

      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq
        nearestT = wrappedT
        scratch.nearestPoint.copy(scratch.boardPoint)
        nearestOffsetDirX = scratch.offsetDir.x
        nearestOffsetDirZ = scratch.offsetDir.z
      }

      if (hasPrevPoint) {
        const segmentDx = scratch.boardPoint.x - scratch.prevBoardPoint.x
        const segmentDz = scratch.boardPoint.z - scratch.prevBoardPoint.z
        const segmentLengthSq = segmentDx * segmentDx + segmentDz * segmentDz

        if (segmentLengthSq > 0.001) {
          const toCarDx = position.x - scratch.prevBoardPoint.x
          const toCarDz = position.z - scratch.prevBoardPoint.z
          const tParam = Math.max(0, Math.min(1, (toCarDx * segmentDx + toCarDz * segmentDz) / segmentLengthSq))
          const closestX = scratch.prevBoardPoint.x + tParam * segmentDx
          const closestZ = scratch.prevBoardPoint.z + tParam * segmentDz
          const segDx = position.x - closestX
          const segDz = position.z - closestZ
          const segDistanceSq = segDx * segDx + segDz * segDz

          if (segDistanceSq < minDistanceSq) {
            minDistanceSq = segDistanceSq
            scratch.nearestPoint.set(closestX, scratch.boardPoint.y, closestZ)
            nearestOffsetDirX = scratch.offsetDir.x
            nearestOffsetDirZ = scratch.offsetDir.z
          }
        }
      }

      scratch.prevBoardPoint.copy(scratch.boardPoint)
      hasPrevPoint = true
    }

    const positionDx = position.x - scratch.nearestPoint.x
    const positionDz = position.z - scratch.nearestPoint.z
    const positionSide = positionDx * nearestOffsetDirX + positionDz * nearestOffsetDirZ
    const boardNormal = positionSide >= 0
      ? { x: nearestOffsetDirX, z: nearestOffsetDirZ }
      : { x: -nearestOffsetDirX, z: -nearestOffsetDirZ }
    const collisionDistance = getCarBoardShapeCollisionDistance({
      carForward,
      boardNormal,
      fallbackRadius: carRadius,
      handling
    })
    const collisionDistanceSq = collisionDistance * collisionDistance

    if (minDistanceSq <= collisionDistanceSq) {
      const distance = Math.sqrt(minDistanceSq)

      board.curve.getTangentAt(nearestT, boardTangent)
      boardTangent.y = 0
      boardTangent.normalize()

      scratch.pushDirection.set(
        position.x - scratch.nearestPoint.x,
        0,
        position.z - scratch.nearestPoint.z
      ).normalize()

      const pushDistance = getCarBoardPushDistance(collisionDistance, distance)
      position.add(scratch.pushDirection.multiplyScalar(pushDistance))

      return { collided: true }
    }
  }

  return { collided: false }
}
