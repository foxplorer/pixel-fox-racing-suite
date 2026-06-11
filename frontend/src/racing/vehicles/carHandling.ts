import { sanitizeSimulationDeltaSeconds } from '../simulation/raceClock'

export interface CarHandlingConfig {
  acceleration: number
  brakingMultiplier: number
  maxSpeedOnTrack: number
  maxSpeedOffTrack: number
  downhillMaxSpeedBoostRatio: number
  offTrackDownhillMaxSpeedBoostRatio: number
  downhillFullBoostGrade: number
  downhillOverspeedBleedRate: number
  offTrackOverspeedBleedRate: number
  reverseSpeedRatio: number
  friction: number
  stopSpeed: number
  turnSpeed: number
  minSteeringSpeed: number
  highSpeedSteeringReduction: number
  collisionRadius: number
  obstacleCollisionMargin: number
  vehicleCollisionMargin: number
  vehicleCollisionMinDistanceSq: number
  obstacleCollisionSpeedMultiplier: number
  vehicleCollisionSpeedMultiplier: number
  boardCollisionSpeedMultiplier: number
  boardCollisionThickness: number
  boardCollisionMargin: number
  boardCollisionPushPadding: number
  boardCollisionCarHalfWidth: number
  boardCollisionCarHalfLength: number
  boardSlidingMinTangentLengthSq: number
  treeCollisionCheckDistance: number
  maxMovementDeltaSeconds: number
  gasVolumeBase: number
  gasVolumeSpeedRange: number
  gasVolumeMultiplier: number
}

export interface CarControlState {
  isAccelerating: boolean
  isBraking: boolean
  isTurningLeft: boolean
  isTurningRight: boolean
}

const CAR_GAS_KEYS = new Set(['KeyG', 'KeyW', 'ArrowUp'])
const CAR_MOVEMENT_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyG'])
const CAR_INACTIVE_SLOWDOWN_STATUSES = new Set(['countdown', 'loading'])

export const SHARED_CAR_HANDLING: CarHandlingConfig = {
  acceleration: 12.0,
  brakingMultiplier: 5.0,
  maxSpeedOnTrack: 75.0,
  maxSpeedOffTrack: 35.0,
  downhillMaxSpeedBoostRatio: 0.18,
  offTrackDownhillMaxSpeedBoostRatio: 0.12,
  downhillFullBoostGrade: 0.08,
  downhillOverspeedBleedRate: 0.55,
  offTrackOverspeedBleedRate: 1.8,
  reverseSpeedRatio: 0.5,
  friction: 0.3,
  stopSpeed: 0.1,
  turnSpeed: 2.0,
  minSteeringSpeed: 1.0,
  highSpeedSteeringReduction: 0.7,
  collisionRadius: 2.0,
  obstacleCollisionMargin: 0.1,
  vehicleCollisionMargin: 0.15,
  vehicleCollisionMinDistanceSq: 0.0001,
  obstacleCollisionSpeedMultiplier: 0.3,
  vehicleCollisionSpeedMultiplier: 0.4,
  boardCollisionSpeedMultiplier: 0.85,
  boardCollisionThickness: 0.05,
  boardCollisionMargin: 0.35,
  boardCollisionPushPadding: 0.1,
  boardCollisionCarHalfWidth: 1.1,
  boardCollisionCarHalfLength: 2.05,
  boardSlidingMinTangentLengthSq: 0.1,
  treeCollisionCheckDistance: 50,
  maxMovementDeltaSeconds: 0.05,
  gasVolumeBase: 0.2,
  gasVolumeSpeedRange: 0.8,
  gasVolumeMultiplier: 0.35
}

export const getCarMaxSpeed = (isOnTrack: boolean, handling: CarHandlingConfig = SHARED_CAR_HANDLING): number => {
  return isOnTrack ? handling.maxSpeedOnTrack : handling.maxSpeedOffTrack
}

export const getCarSlopeAdjustedMaxSpeed = ({
  isOnTrack,
  slopeGrade = 0,
  handling = SHARED_CAR_HANDLING
}: {
  isOnTrack: boolean
  slopeGrade?: number
  handling?: CarHandlingConfig
}): number => {
  const baseMaxSpeed = getCarMaxSpeed(isOnTrack, handling)
  if (!Number.isFinite(slopeGrade) || slopeGrade >= 0) {
    return baseMaxSpeed
  }

  const downhillGrade = Math.min(Math.abs(slopeGrade), handling.downhillFullBoostGrade)
  const maxBoostRatio = isOnTrack
    ? handling.downhillMaxSpeedBoostRatio
    : handling.offTrackDownhillMaxSpeedBoostRatio
  const boostRatio = maxBoostRatio * (downhillGrade / handling.downhillFullBoostGrade)
  return baseMaxSpeed * (1 + boostRatio)
}

export const getCarControlState = (keys: Record<string, boolean>): CarControlState => {
  return {
    isAccelerating: Boolean(keys.KeyW || keys.ArrowUp || keys.KeyG),
    isBraking: Boolean(keys.KeyS || keys.ArrowDown),
    isTurningLeft: Boolean(keys.KeyA || keys.ArrowLeft),
    isTurningRight: Boolean(keys.KeyD || keys.ArrowRight)
  }
}

export const capCarMovementDelta = (
  deltaSeconds: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): number => {
  return sanitizeSimulationDeltaSeconds(deltaSeconds, handling.maxMovementDeltaSeconds)
}

export const getCarGasVolume = (
  speed: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): number => {
  const speedRatio = Math.abs(speed) / handling.maxSpeedOnTrack
  const volume = (handling.gasVolumeBase + speedRatio * handling.gasVolumeSpeedRange) * handling.gasVolumeMultiplier
  return Math.max(0, Math.min(1, volume))
}

export const canAdvanceCarFrame = (gameStatus: string): boolean => {
  return gameStatus === 'racing'
}

export const getInactiveCarSpeed = ({
  gameStatus,
  speed,
  slowdownFactor = 0.1,
  handling = SHARED_CAR_HANDLING
}: {
  gameStatus: string
  speed: number
  slowdownFactor?: number
  handling?: CarHandlingConfig
}): number => {
  if (!CAR_INACTIVE_SLOWDOWN_STATUSES.has(gameStatus)) {
    return speed
  }

  const nextSpeed = speed + (0 - speed) * slowdownFactor
  return Math.abs(nextSpeed) < handling.stopSpeed ? 0 : nextSpeed
}

export const getCarBoardCollisionDistance = (
  carRadius: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): number => {
  return carRadius + handling.boardCollisionThickness + handling.boardCollisionMargin
}

export const getCarBoardShapeCollisionDistance = ({
  carForward,
  boardNormal,
  fallbackRadius,
  handling = SHARED_CAR_HANDLING
}: {
  carForward?: { x: number; z: number } | null
  boardNormal: { x: number; z: number }
  fallbackRadius: number
  handling?: CarHandlingConfig
}): number => {
  if (!carForward) {
    return getCarBoardCollisionDistance(fallbackRadius, handling)
  }

  const forwardLength = Math.hypot(carForward.x, carForward.z)
  const normalLength = Math.hypot(boardNormal.x, boardNormal.z)
  if (forwardLength <= 0.0001 || normalLength <= 0.0001) {
    return getCarBoardCollisionDistance(fallbackRadius, handling)
  }

  const forwardX = carForward.x / forwardLength
  const forwardZ = carForward.z / forwardLength
  const normalX = boardNormal.x / normalLength
  const normalZ = boardNormal.z / normalLength
  const rightX = -forwardZ
  const rightZ = forwardX
  const forwardProjection = Math.abs(forwardX * normalX + forwardZ * normalZ)
  const sideProjection = Math.abs(rightX * normalX + rightZ * normalZ)
  const shapeExtent = handling.boardCollisionCarHalfLength * forwardProjection +
    handling.boardCollisionCarHalfWidth * sideProjection

  return shapeExtent + handling.boardCollisionThickness + handling.boardCollisionMargin
}

export const getCarBoardPushDistance = (
  collisionDistance: number,
  currentDistance: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): number => {
  return collisionDistance - currentDistance + handling.boardCollisionPushPadding
}

export const shouldUseCarBoardSlidingTangent = (
  isSlidingAlongBoard: boolean,
  tangentLengthSq: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): boolean => {
  return isSlidingAlongBoard && tangentLengthSq > handling.boardSlidingMinTangentLengthSq
}

export const getCarBoardSlidingDirection = (forwardDotTangent: number): 1 | -1 => {
  return forwardDotTangent > 0 ? 1 : -1
}

export interface BoardSlidingForwardAdjustment {
  shouldSlide: boolean
  direction: 1 | -1
}

export const getBoardSlidingForwardAdjustment = ({
  isSlidingAlongBoard,
  tangentLengthSq,
  forwardDotTangent
}: {
  isSlidingAlongBoard: boolean
  tangentLengthSq: number
  forwardDotTangent: number
}): BoardSlidingForwardAdjustment => {
  const shouldSlide = shouldUseCarBoardSlidingTangent(isSlidingAlongBoard, tangentLengthSq)

  return {
    shouldSlide,
    direction: shouldSlide ? getCarBoardSlidingDirection(forwardDotTangent) : 1
  }
}

export interface CarForwardVector {
  x: number
  z: number
}

export interface MutableCarMovementVector {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): this
  copy(vector: MutableCarMovementVector): this
  add(vector: MutableCarMovementVector): this
  multiplyScalar(scalar: number): this
  normalize(): this
  dot(vector: MutableCarMovementVector): number
  lengthSq(): number
}

export const getCarForwardVector = (rotationRadians: number): CarForwardVector => {
  const stableRotation = getStableCarRotation(rotationRadians)

  return {
    x: -Math.sin(stableRotation),
    z: -Math.cos(stableRotation)
  }
}

export interface AdvanceCarMovementFrameInput {
  rotationRadians: number
  speed: number
  deltaSeconds: number
  position: MutableCarMovementVector
  forward: MutableCarMovementVector
  velocity: MutableCarMovementVector
  movementDelta: MutableCarMovementVector
  nextPosition: MutableCarMovementVector
  boardSliding?: {
    isSlidingAlongBoard: boolean
    tangent: MutableCarMovementVector
  }
  handling?: CarHandlingConfig
}

export const advanceCarMovementFrame = ({
  rotationRadians,
  speed,
  deltaSeconds,
  position,
  forward,
  velocity,
  movementDelta,
  nextPosition,
  boardSliding,
  handling = SHARED_CAR_HANDLING
}: AdvanceCarMovementFrameInput): void => {
  const carForward = getCarForwardVector(rotationRadians)
  forward.set(carForward.x, 0, carForward.z)

  if (boardSliding) {
    const boardSlidingAdjustment = getBoardSlidingForwardAdjustment({
      isSlidingAlongBoard: boardSliding.isSlidingAlongBoard,
      tangentLengthSq: boardSliding.tangent.lengthSq(),
      forwardDotTangent: forward.dot(boardSliding.tangent)
    })

    if (boardSlidingAdjustment.shouldSlide) {
      forward.copy(boardSliding.tangent).multiplyScalar(boardSlidingAdjustment.direction)
      forward.normalize()
    }
  }

  velocity.copy(forward).multiplyScalar(speed)
  movementDelta.copy(velocity).multiplyScalar(capCarMovementDelta(deltaSeconds, handling))
  nextPosition.copy(position).add(movementDelta)
}

export const getCarDisplacement = (
  rotationRadians: number,
  speed: number,
  deltaSeconds: number
): CarForwardVector => {
  const forward = getCarForwardVector(rotationRadians)

  return {
    x: forward.x * speed * deltaSeconds,
    z: forward.z * speed * deltaSeconds
  }
}

export const isCarGasKey = (keyCode: string): boolean => {
  return CAR_GAS_KEYS.has(keyCode)
}

export const isCarMovementKey = (keyCode: string): boolean => {
  return CAR_MOVEMENT_KEYS.has(keyCode)
}

export const hasActiveCarGasKey = (keys: Record<string, boolean>): boolean => {
  return Array.from(CAR_GAS_KEYS).some(keyCode => Boolean(keys[keyCode]))
}

export const isAnyCarControlActive = (controls: CarControlState): boolean => {
  return controls.isAccelerating || controls.isBraking || controls.isTurningLeft || controls.isTurningRight
}

export const getCarSteeringSensitivity = (
  speed: number,
  maxSpeed: number,
  handling: CarHandlingConfig = SHARED_CAR_HANDLING
): number => {
  if (maxSpeed <= 0) return 1

  const speedRatio = Math.min(Math.abs(speed) / maxSpeed, 1)
  return 1 - speedRatio * handling.highSpeedSteeringReduction
}

export interface IntegrateCarSpeedInput {
  speed: number
  deltaSeconds: number
  isAccelerating: boolean
  isBraking: boolean
  isOnTrack: boolean
  maxSpeed?: number
  handling?: CarHandlingConfig
}

export const integrateCarSpeed = ({
  speed,
  deltaSeconds,
  isAccelerating,
  isBraking,
  isOnTrack,
  maxSpeed: providedMaxSpeed,
  handling = SHARED_CAR_HANDLING
}: IntegrateCarSpeedInput): number => {
  const maxSpeed = providedMaxSpeed ?? getCarMaxSpeed(isOnTrack, handling)
  let nextSpeed = speed

  if (speed > maxSpeed && isAccelerating) {
    const bleedRate = isOnTrack ? handling.downhillOverspeedBleedRate : handling.offTrackOverspeedBleedRate
    nextSpeed = speed + (maxSpeed - speed) * bleedRate * deltaSeconds
  } else if (isAccelerating) {
    nextSpeed = Math.min(speed + handling.acceleration * deltaSeconds, maxSpeed)
  } else if (isBraking) {
    nextSpeed = Math.max(
      speed - handling.acceleration * deltaSeconds * handling.brakingMultiplier,
      -maxSpeed * handling.reverseSpeedRatio
    )
  } else {
    nextSpeed = speed + (0 - speed) * handling.friction * deltaSeconds
    if (Math.abs(nextSpeed) < handling.stopSpeed) nextSpeed = 0
  }

  if (nextSpeed > maxSpeed && speed <= maxSpeed) {
    return maxSpeed
  }

  return nextSpeed
}

export interface AdvanceCarControlFrameInput {
  keys: Record<string, boolean>
  speed: number
  rotationRadians: number
  deltaSeconds: number
  isOnTrack: boolean
  slopeGrade?: number
  handling?: CarHandlingConfig
}

export interface AdvanceCarControlFrameResult {
  controls: CarControlState
  maxSpeed: number
  speed: number
  rotationRadians: number
}

export const advanceCarControlFrame = ({
  keys,
  speed,
  rotationRadians,
  deltaSeconds,
  isOnTrack,
  slopeGrade = 0,
  handling = SHARED_CAR_HANDLING
}: AdvanceCarControlFrameInput): AdvanceCarControlFrameResult => {
  const controls = getCarControlState(keys)
  const cappedDeltaSeconds = capCarMovementDelta(deltaSeconds, handling)
  const maxSpeed = getCarSlopeAdjustedMaxSpeed({ isOnTrack, slopeGrade, handling })
  const nextSpeed = integrateCarSpeed({
    speed,
    deltaSeconds: cappedDeltaSeconds,
    isAccelerating: controls.isAccelerating,
    isBraking: controls.isBraking,
    isOnTrack,
    maxSpeed,
    handling
  })
  const nextRotation = integrateCarRotation({
    rotationRadians,
    speed: nextSpeed,
    maxSpeed,
    deltaSeconds: cappedDeltaSeconds,
    isTurningLeft: controls.isTurningLeft,
    isTurningRight: controls.isTurningRight,
    handling
  })

  return {
    controls,
    maxSpeed,
    speed: nextSpeed,
    rotationRadians: nextRotation
  }
}

export const normalizeCarRotation = (rotationRadians: number): number => {
  let normalized = rotationRadians

  while (normalized > Math.PI) {
    normalized -= 2 * Math.PI
  }

  while (normalized < -Math.PI) {
    normalized += 2 * Math.PI
  }

  return normalized
}

export const getStableCarRotation = (rotationRadians: number, fallbackRotationRadians = 0): number => {
  if (Number.isFinite(rotationRadians)) {
    return normalizeCarRotation(rotationRadians)
  }

  if (Number.isFinite(fallbackRotationRadians)) {
    return normalizeCarRotation(fallbackRotationRadians)
  }

  return 0
}

export interface IntegrateCarRotationInput {
  rotationRadians: number
  speed: number
  maxSpeed: number
  deltaSeconds: number
  isTurningLeft: boolean
  isTurningRight: boolean
  handling?: CarHandlingConfig
}

export const integrateCarRotation = ({
  rotationRadians,
  speed,
  maxSpeed,
  deltaSeconds,
  isTurningLeft,
  isTurningRight,
  handling = SHARED_CAR_HANDLING
}: IntegrateCarRotationInput): number => {
  if (Math.abs(speed) <= handling.minSteeringSpeed) {
    return getStableCarRotation(rotationRadians)
  }

  const steeringSensitivity = getCarSteeringSensitivity(speed, maxSpeed, handling)
  const effectiveTurnSpeed = handling.turnSpeed * steeringSensitivity
  const signedTurn = effectiveTurnSpeed * deltaSeconds * Math.sign(speed)
  let nextRotation = rotationRadians

  if (isTurningLeft) {
    nextRotation += signedTurn
  }

  if (isTurningRight) {
    nextRotation -= signedTurn
  }

  return getStableCarRotation(nextRotation)
}
