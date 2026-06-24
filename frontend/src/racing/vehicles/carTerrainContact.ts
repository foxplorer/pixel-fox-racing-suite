export interface CarTerrainContactState {
  airborne: boolean
  verticalVelocity: number
}

export interface CarTerrainContactFrame {
  height: number
  speed: number
  airborne: boolean
  blockedBySteepClimb: boolean
}

export const createCarTerrainContactState = (): CarTerrainContactState => ({
  airborne: false,
  verticalVelocity: 0
})

export const CAR_TERRAIN_GRAVITY = 38
export const CAR_TERRAIN_CLIFF_DROP_THRESHOLD = 1.1
export const CAR_TERRAIN_MAX_CLIMB_GRADE = 0.45
export const CAR_TERRAIN_MAX_CLIMB_STEP = 0.75
export const CAR_TERRAIN_STEEP_CLIMB_SPEED_MULTIPLIER = 0.35
// Horizontal speed bleed while sailing off a cliff, so a car with no tire contact
// coasts down rather than holding full speed — same idea as the jump's air drag.
export const CAR_TERRAIN_AIR_DRAG_PER_SECOND = 0.22

export const getCarTerrainMaxClimbDelta = (horizontalDistance: number): number => {
  const safeDistance = Number.isFinite(horizontalDistance) ? Math.max(0, horizontalDistance) : 0
  return CAR_TERRAIN_MAX_CLIMB_STEP + safeDistance * CAR_TERRAIN_MAX_CLIMB_GRADE
}

export const isCarTerrainClimbTooSteep = ({
  currentY,
  targetY,
  horizontalDistance
}: {
  currentY: number
  targetY: number
  horizontalDistance: number
}): boolean => {
  if (!Number.isFinite(currentY) || !Number.isFinite(targetY)) return false
  return targetY - currentY > getCarTerrainMaxClimbDelta(horizontalDistance)
}

export const advanceCarTerrainContact = ({
  state,
  currentY,
  targetY,
  speed,
  deltaSeconds,
  horizontalDistance,
  canLeaveGround = true
}: {
  state: CarTerrainContactState
  currentY: number
  targetY: number
  speed: number
  deltaSeconds: number
  horizontalDistance: number
  canLeaveGround?: boolean
}): CarTerrainContactFrame => {
  if (isCarTerrainClimbTooSteep({ currentY, targetY, horizontalDistance })) {
    state.airborne = false
    state.verticalVelocity = 0
    return {
      height: currentY,
      speed: speed * CAR_TERRAIN_STEEP_CLIMB_SPEED_MULTIPLIER,
      airborne: false,
      blockedBySteepClimb: true
    }
  }

  if (
    canLeaveGround &&
    !state.airborne &&
    Number.isFinite(currentY) &&
    Number.isFinite(targetY) &&
    currentY - targetY > CAR_TERRAIN_CLIFF_DROP_THRESHOLD
  ) {
    state.airborne = true
    state.verticalVelocity = Math.min(0, state.verticalVelocity)
  }

  if (!state.airborne) {
    state.verticalVelocity = 0
    return { height: targetY, speed, airborne: false, blockedBySteepClimb: false }
  }

  // Airborne: bleed horizontal speed (air drag) and integrate gravity. Faster cars
  // therefore carry farther off the edge before they land; slow ones just drop.
  const drag = Math.min(CAR_TERRAIN_AIR_DRAG_PER_SECOND * deltaSeconds, 0.5)
  const draggedSpeed = speed * (1 - drag)
  state.verticalVelocity -= CAR_TERRAIN_GRAVITY * deltaSeconds
  const airborneHeight = currentY + state.verticalVelocity * deltaSeconds

  if (airborneHeight <= targetY && state.verticalVelocity <= 0) {
    state.airborne = false
    state.verticalVelocity = 0
    return { height: targetY, speed: draggedSpeed, airborne: false, blockedBySteepClimb: false }
  }

  return { height: airborneHeight, speed: draggedSpeed, airborne: true, blockedBySteepClimb: false }
}
