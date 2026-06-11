export interface CircleCollisionInput {
  ax: number
  az: number
  ar: number
  bx: number
  bz: number
  br: number
  margin?: number
  minDistanceSq?: number
}

export interface CircleCollisionResponse {
  collided: boolean
  pushX: number
  pushZ: number
  pushDistance: number
  distance: number
  minDistance: number
}

export interface MutableXZPosition {
  x: number
  z: number
}

export const resolveCircleCollision2D = ({
  ax,
  az,
  ar,
  bx,
  bz,
  br,
  margin = 0,
  minDistanceSq = 0
}: CircleCollisionInput): CircleCollisionResponse => {
  const dx = ax - bx
  const dz = az - bz
  const distanceSq = dx * dx + dz * dz
  const minDistance = ar + br

  if (distanceSq >= minDistance * minDistance || distanceSq <= minDistanceSq) {
    return {
      collided: false,
      pushX: 0,
      pushZ: 0,
      pushDistance: 0,
      distance: Math.sqrt(distanceSq),
      minDistance
    }
  }

  const distance = Math.sqrt(distanceSq)
  const inverseDistance = distance > 0 ? 1 / distance : 0
  const pushDistance = minDistance - distance + margin

  return {
    collided: true,
    pushX: dx * inverseDistance,
    pushZ: dz * inverseDistance,
    pushDistance,
    distance,
    minDistance
  }
}

export const applyCircleCollisionPush2D = (
  position: MutableXZPosition,
  collision: CircleCollisionResponse
): void => {
  if (!collision.collided) return

  position.x += collision.pushX * collision.pushDistance
  position.z += collision.pushZ * collision.pushDistance
}
