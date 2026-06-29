import type { MutableXZPosition } from '../core/circleCollision'
import { getCarForwardVector } from './carHandling'

export type PlayerVehicleCollisionKind =
  | 'rear-end'
  | 'side-swipe'
  | 'angled'
  | 'head-on'
  | 'staging-overlap'

export interface PlayerVehicleCollisionTarget {
  id?: string
  position: [number, number, number]
  rotation?: [number, number, number]
  speed?: number
}

export interface PlayerVehicleContactState {
  lastCollisionAt: number
  contactFrames: number
  lastKind?: PlayerVehicleCollisionKind
}

export type PlayerVehicleContactStateStore = Map<string, PlayerVehicleContactState>

export interface PlayerVehicleCollisionInput<TTarget extends PlayerVehicleCollisionTarget> {
  position: MutableXZPosition
  previousPosition?: MutableXZPosition
  speed: number
  rotationY?: number
  carRadius: number
  target: TTarget
  margin: number
  minDistanceSq: number
  gameStatus?: string
  contactState?: PlayerVehicleContactStateStore
  nowMs?: number
  sustainedContactWindowMs?: number
}

export interface PlayerVehicleCollisionResult<TTarget extends PlayerVehicleCollisionTarget> {
  collided: boolean
  kind?: PlayerVehicleCollisionKind
  target?: TTarget
  speed: number
  overlapDepth: number
  contactNormal: { x: number; z: number }
}

const COLLIDABLE_STATUS = new Set(['racing', 'crashed', 'finished'])
const DEFAULT_SUSTAINED_CONTACT_WINDOW_MS = 350

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const finiteNumber = (value: number | undefined, fallback: number): number => {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

const dot = (ax: number, az: number, bx: number, bz: number): number => ax * bx + az * bz

const getContactStateKey = <TTarget extends PlayerVehicleCollisionTarget>(target: TTarget): string | undefined => {
  return target.id ? `player:${target.id}` : undefined
}

const getMovementForward = (
  speed: number,
  rotationY: number | undefined,
  previousPosition: MutableXZPosition | undefined,
  position: MutableXZPosition
): { x: number; z: number } => {
  if (rotationY !== undefined && Number.isFinite(rotationY)) {
    return getCarForwardVector(rotationY)
  }

  if (previousPosition) {
    const dx = position.x - previousPosition.x
    const dz = position.z - previousPosition.z
    const length = Math.hypot(dx, dz)
    if (length > 0.0001) {
      return {
        x: Math.sign(speed || 1) * dx / length,
        z: Math.sign(speed || 1) * dz / length
      }
    }
  }

  return { x: 0, z: -1 }
}

const getTargetForward = <TTarget extends PlayerVehicleCollisionTarget>(
  target: TTarget,
  fallback: { x: number; z: number }
): { x: number; z: number } => {
  const rotationY = target.rotation?.[1]
  if (rotationY !== undefined && Number.isFinite(rotationY)) {
    return getCarForwardVector(rotationY)
  }
  return fallback
}

const classifyPlayerVehicleContact = ({
  localForward,
  targetForward,
  contactNormal
}: {
  localForward: { x: number; z: number }
  targetForward: { x: number; z: number }
  contactNormal: { x: number; z: number }
}): PlayerVehicleCollisionKind => {
  const headingDot = dot(localForward.x, localForward.z, targetForward.x, targetForward.z)
  const localImpactDot = dot(localForward.x, localForward.z, -contactNormal.x, -contactNormal.z)
  const targetRearDot = dot(targetForward.x, targetForward.z, -contactNormal.x, -contactNormal.z)
  const sideDot = Math.abs(dot(localForward.x, localForward.z, contactNormal.x, contactNormal.z))

  if (headingDot < -0.45) return 'head-on'
  if (headingDot > 0.65 && localImpactDot > 0.35 && targetRearDot > 0.2) return 'rear-end'
  if (headingDot > 0.55 && sideDot < 0.45) return 'side-swipe'
  return 'angled'
}

export const resolvePlayerVehicleCollision = <TTarget extends PlayerVehicleCollisionTarget>({
  position,
  previousPosition,
  speed,
  rotationY,
  carRadius,
  target,
  margin,
  minDistanceSq,
  gameStatus = 'racing',
  contactState,
  nowMs = Date.now(),
  sustainedContactWindowMs = DEFAULT_SUSTAINED_CONTACT_WINDOW_MS
}: PlayerVehicleCollisionInput<TTarget>): PlayerVehicleCollisionResult<TTarget> => {
  if (!COLLIDABLE_STATUS.has(gameStatus)) {
    return {
      collided: false,
      kind: 'staging-overlap',
      target,
      speed,
      overlapDepth: 0,
      contactNormal: { x: 0, z: 0 }
    }
  }

  const dx = position.x - target.position[0]
  const dz = position.z - target.position[2]
  const distanceSq = dx * dx + dz * dz
  const collisionDistance = carRadius + carRadius + margin

  if (distanceSq >= collisionDistance * collisionDistance || distanceSq < minDistanceSq) {
    return {
      collided: false,
      target,
      speed,
      overlapDepth: 0,
      contactNormal: { x: 0, z: 0 }
    }
  }

  const distance = Math.sqrt(distanceSq)
  const normalX = distance > 0.0001 ? dx / distance : 1
  const normalZ = distance > 0.0001 ? dz / distance : 0
  const overlapDepth = collisionDistance - distance

  position.x += normalX * overlapDepth
  position.z += normalZ * overlapDepth

  const localForward = getMovementForward(speed, rotationY, previousPosition, position)
  const targetSpeed = Math.max(0, finiteNumber(target.speed, 0))
  const targetForward = getTargetForward(target, localForward)
  const contactNormal = { x: normalX, z: normalZ }
  const kind = classifyPlayerVehicleContact({ localForward, targetForward, contactNormal })
  const absSpeed = Math.abs(speed)
  const closingSpeed = Math.max(0, absSpeed - targetSpeed)

  let nextAbsSpeed = absSpeed
  if (kind === 'rear-end') {
    const bumpDraftFloor = targetSpeed > 0 ? targetSpeed * 0.9 : 0
    const retainedOwnSpeed = absSpeed - closingSpeed * 0.35
    nextAbsSpeed = Math.max(bumpDraftFloor, retainedOwnSpeed, absSpeed * 0.72)
  } else if (kind === 'side-swipe') {
    nextAbsSpeed = absSpeed * 0.9
  } else if (kind === 'angled') {
    nextAbsSpeed = Math.max(targetSpeed * 0.55, absSpeed * 0.62)
  } else {
    nextAbsSpeed = absSpeed * 0.32
  }

  if (absSpeed < 3 && targetSpeed < 3) {
    nextAbsSpeed = Math.min(nextAbsSpeed, Math.max(absSpeed, targetSpeed, 1.5))
  }

  const contactStateKey = contactState ? getContactStateKey(target) : undefined
  const previousContact = contactStateKey ? contactState?.get(contactStateKey) : undefined
  const isSustainedContact = Boolean(
    previousContact &&
    nowMs - previousContact.lastCollisionAt <= sustainedContactWindowMs
  )

  if (isSustainedContact) {
    const sustainedRetention = kind === 'head-on' ? 0.9 : 0.96
    nextAbsSpeed = Math.max(nextAbsSpeed, absSpeed * sustainedRetention)
  }

  if (contactState && contactStateKey) {
    contactState.set(contactStateKey, {
      lastCollisionAt: nowMs,
      contactFrames: isSustainedContact ? (previousContact?.contactFrames ?? 0) + 1 : 1,
      lastKind: kind
    })
  }

  return {
    collided: true,
    kind,
    target,
    speed: Math.sign(speed || 1) * clamp(nextAbsSpeed, 0, Math.max(absSpeed, targetSpeed) + 8),
    overlapDepth,
    contactNormal
  }
}
