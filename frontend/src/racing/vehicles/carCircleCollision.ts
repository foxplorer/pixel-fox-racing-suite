import type { MutableXZPosition } from '../core/circleCollision'
import { applyCircleCollisionPush2D, resolveCircleCollision2D } from '../core/circleCollision'
import type { CarHandlingConfig } from './carHandling'
import { SHARED_CAR_HANDLING } from './carHandling'

export interface CarCircleCollisionTarget {
  x: number
  z: number
  radius: number
}

export interface CarPlayerCollisionTarget {
  position: [number, number, number]
}

export interface ResolveCarObstacleCollisionOptions<TTarget extends CarCircleCollisionTarget> {
  position: MutableXZPosition
  carRadius: number
  targets: TTarget[]
  handling?: CarHandlingConfig
  maxCheckDistance?: number
  onCollision?: (target: TTarget) => void
}

export interface ResolveCarPlayerCollisionOptions<TTarget extends CarPlayerCollisionTarget> {
  position: MutableXZPosition
  carRadius: number
  players: TTarget[]
  handling?: CarHandlingConfig
}

export interface CarTargetCollisionResult<TTarget> {
  collided: boolean
  target?: TTarget
}

export const resolveCarObstacleCollision = <TTarget extends CarCircleCollisionTarget>({
  position,
  carRadius,
  targets,
  handling = SHARED_CAR_HANDLING,
  maxCheckDistance,
  onCollision
}: ResolveCarObstacleCollisionOptions<TTarget>): CarTargetCollisionResult<TTarget> => {
  const maxCheckDistanceSq = maxCheckDistance === undefined ? undefined : maxCheckDistance * maxCheckDistance

  for (const target of targets) {
    if (maxCheckDistanceSq !== undefined) {
      const dx = position.x - target.x
      const dz = position.z - target.z
      const distanceSq = dx * dx + dz * dz

      if (distanceSq > maxCheckDistanceSq) {
        continue
      }
    }

    const collision = resolveCircleCollision2D({
      ax: position.x,
      az: position.z,
      ar: carRadius,
      bx: target.x,
      bz: target.z,
      br: target.radius,
      margin: handling.obstacleCollisionMargin
    })

    if (collision.collided) {
      applyCircleCollisionPush2D(position, collision)
      onCollision?.(target)
      return { collided: true, target }
    }
  }

  return { collided: false }
}

export const resolveCarPlayerCollision = <TTarget extends CarPlayerCollisionTarget>({
  position,
  carRadius,
  players,
  handling = SHARED_CAR_HANDLING
}: ResolveCarPlayerCollisionOptions<TTarget>): CarTargetCollisionResult<TTarget> => {
  for (const player of players) {
    const collision = resolveCircleCollision2D({
      ax: position.x,
      az: position.z,
      ar: carRadius,
      bx: player.position[0],
      bz: player.position[2],
      br: carRadius,
      margin: handling.vehicleCollisionMargin,
      minDistanceSq: handling.vehicleCollisionMinDistanceSq
    })

    if (collision.collided) {
      applyCircleCollisionPush2D(position, collision)
      return { collided: true, target: player }
    }
  }

  return { collided: false }
}
