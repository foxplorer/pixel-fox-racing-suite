import type { MutableXZPosition } from '../core/circleCollision'
import type { RacingWorldPlayerCollisionTarget } from '../multiplayer/worldPlayers'
import type { RacingAdvertisingBoard, CarBoardCollisionScratch } from './carBoardCollision'
import { resolveCarAdvertisingBoardCollision } from './carBoardCollision'
import { resolveCarObstacleCollision, type CarCircleCollisionTarget } from './carCircleCollision'
import type { CarHandlingConfig } from './carHandling'
import { SHARED_CAR_HANDLING } from './carHandling'
import { resolvePlayerVehicleCollision, type PlayerVehicleContactStateStore } from './playerVehicleCollision'

export interface CarFrameBoardCollisionOptions {
  boards?: RacingAdvertisingBoard[]
  carForward?: MutableXZPosition
  boardTangent: MutableXZPosition & {
    y: number
    normalize(): unknown
  }
  scratch: CarBoardCollisionScratch
}

export interface ResolveCarCollisionFrameOptions<
  TObstacle extends CarCircleCollisionTarget,
  TPole extends CarCircleCollisionTarget
> {
  position: MutableXZPosition
  previousPosition?: MutableXZPosition
  speed: number
  rotationY?: number
  gameStatus?: string
  playerContactState?: PlayerVehicleContactStateStore
  nowMs?: number
  treeTargets: TObstacle[]
  startingGatePoles: TPole[]
  players: RacingWorldPlayerCollisionTarget[]
  handling?: CarHandlingConfig
  treeMaxCheckDistance?: number
  onTreeCollision?: (target: TObstacle) => void
  boardCollision?: CarFrameBoardCollisionOptions
}

export interface CarCollisionFrameResult {
  collided: boolean
  speed: number
  isSlidingAlongBoard: boolean
  playerCollision?: {
    playerId?: string
    kind?: string
    overlapDepth: number
    contactNormal: { x: number; z: number }
  }
}

export const resolveCarCollisionFrame = <
  TObstacle extends CarCircleCollisionTarget,
  TPole extends CarCircleCollisionTarget
>({
  position,
  previousPosition,
  speed,
  rotationY,
  gameStatus,
  playerContactState,
  nowMs,
  treeTargets,
  startingGatePoles,
  players,
  handling = SHARED_CAR_HANDLING,
  treeMaxCheckDistance,
  onTreeCollision,
  boardCollision
}: ResolveCarCollisionFrameOptions<TObstacle, TPole>): CarCollisionFrameResult => {
  const carRadius = handling.collisionRadius

  const treeCollision = resolveCarObstacleCollision({
    position,
    carRadius,
    targets: treeTargets,
    maxCheckDistance: treeMaxCheckDistance,
    onCollision: onTreeCollision,
    handling
  })

  if (treeCollision.collided) {
    return {
      collided: true,
      speed: speed * handling.obstacleCollisionSpeedMultiplier,
      isSlidingAlongBoard: false
    }
  }

  const poleCollision = resolveCarObstacleCollision({
    position,
    carRadius,
    targets: startingGatePoles,
    handling
  })

  if (poleCollision.collided) {
    return {
      collided: true,
      speed: speed * handling.obstacleCollisionSpeedMultiplier,
      isSlidingAlongBoard: false
    }
  }

  if (boardCollision && boardCollision.boards && boardCollision.boards.length > 0) {
    const advertisingBoardCollision = resolveCarAdvertisingBoardCollision({
      position: position as Parameters<typeof resolveCarAdvertisingBoardCollision>[0]['position'],
      boards: boardCollision.boards,
      carRadius,
      carForward: boardCollision.carForward as Parameters<typeof resolveCarAdvertisingBoardCollision>[0]['carForward'],
      boardTangent: boardCollision.boardTangent as Parameters<typeof resolveCarAdvertisingBoardCollision>[0]['boardTangent'],
      scratch: boardCollision.scratch,
      handling
    })

    if (advertisingBoardCollision.collided) {
      return {
        collided: true,
        speed: speed * handling.boardCollisionSpeedMultiplier,
        isSlidingAlongBoard: true
      }
    }
  }

  if (players.length > 0) {
    for (const player of players) {
      const playerVehicleCollision = resolvePlayerVehicleCollision({
        position,
        previousPosition,
        speed,
        rotationY,
        carRadius,
        target: player,
        margin: handling.vehicleCollisionMargin,
        minDistanceSq: handling.vehicleCollisionMinDistanceSq,
        gameStatus,
        contactState: playerContactState,
        nowMs
      })

      if (playerVehicleCollision.collided) {
        return {
          collided: true,
          speed: playerVehicleCollision.speed,
          isSlidingAlongBoard: false,
          playerCollision: {
            playerId: player.id,
            kind: playerVehicleCollision.kind,
            overlapDepth: playerVehicleCollision.overlapDepth,
            contactNormal: playerVehicleCollision.contactNormal
          }
        }
      }
    }
  }

  return {
    collided: false,
    speed,
    isSlidingAlongBoard: false
  }
}
