/**
 * Opt-in "jump" physics for cars launching over gaps (e.g. the lava pits on the
 * Volcanoes track). Tracks that pass no jump zones are completely unaffected:
 * `advanceCarJump` returns the grounded height unchanged and never goes airborne.
 *
 * When the car crosses a zone above the launch speed it leaves the ground with
 * an upward velocity scaled by how fast it is going (faster = bigger air), loses
 * some horizontal speed off the ramp, then sheds more speed while airborne until
 * it returns to the surface height it would otherwise sit at. A zone only re-arms
 * once the car has left every zone, so a single pit produces a single launch
 * rather than re-triggering each frame.
 */

export interface CarJumpZone {
  x: number
  z: number
  /** Detection radius around the pit center; launch fires on entry. */
  radius: number
}

export interface CarJumpState {
  airborne: boolean
  verticalVelocity: number
  /** Current airborne height, integrated independently of surface follow. */
  height: number
  /** False after a launch until the car has cleared every zone again. */
  armed: boolean
}

export const createCarJumpState = (): CarJumpState => ({
  airborne: false,
  verticalVelocity: 0,
  height: 0,
  armed: true
})

// Minimum forward/reverse speed (units/s) needed to trigger a launch. Below this
// the car just rolls across the gap at ground level. Car top speed is ~75.
export const CAR_JUMP_MIN_LAUNCH_SPEED = 20
// Downward acceleration applied while airborne (units/s^2).
export const CAR_JUMP_GRAVITY = 32
// Baseline upward launch velocity (units/s) plus a speed-scaled bonus. Tuned to pop
// the car clearly up off the ramp lip and carry it across a wide lava pit.
export const CAR_JUMP_LAUNCH_BASE = 22
export const CAR_JUMP_LAUNCH_SPEED_SCALE = 0.28
// Ramp takeoff should cost momentum, and airborne cars should not accelerate
// beyond their launch speed while they have no tire contact.
export const CAR_JUMP_TAKEOFF_SPEED_MULTIPLIER = 0.82
export const CAR_JUMP_AIR_DRAG_PER_SECOND = 0.22

export interface CarJumpFrame {
  height: number
  speed: number
}

export const findActiveCarJumpZone = (
  x: number,
  z: number,
  zones: readonly CarJumpZone[]
): CarJumpZone | null => {
  for (const zone of zones) {
    const dx = x - zone.x
    const dz = z - zone.z
    if (dx * dx + dz * dz <= zone.radius * zone.radius) return zone
  }
  return null
}

/**
 * Advances the jump state by one frame and returns the height/speed the car
 * should use. `groundedY` is the height the surface-follow logic already
 * resolved for this frame (the landing reference).
 */
export const advanceCarJump = ({
  state,
  zones,
  x,
  z,
  groundedY,
  currentY,
  speed,
  deltaSeconds,
  canMove
}: {
  state: CarJumpState
  zones: readonly CarJumpZone[]
  x: number
  z: number
  groundedY: number
  /**
   * The car's height at the start of this frame (last frame's rendered y). At the
   * instant of launch the car is cresting the ramp lip, but `groundedY` has already
   * dropped to the gap floor (no ramp over the pit). Launching from the higher of the
   * two starts the arc at the lip instead of throwing away the lip height — so the car
   * pops up off the kicker rather than rolling over the top. Defaults to `groundedY`.
   */
  currentY?: number
  speed: number
  deltaSeconds: number
  canMove: boolean
}): CarJumpFrame => {
  if (zones.length === 0) return { height: groundedY, speed }

  const inZone = findActiveCarJumpZone(x, z, zones) !== null
  let nextSpeed = speed

  if (!state.airborne) {
    const canLaunch =
      state.armed && canMove && inZone && Math.abs(speed) >= CAR_JUMP_MIN_LAUNCH_SPEED
    if (!canLaunch) {
      // Re-arm only once fully clear of every zone, so a car that decelerates
      // inside a pit doesn't get a free second launch on the same crossing.
      if (!inZone) state.armed = true
      return { height: groundedY, speed: nextSpeed }
    }
    state.airborne = true
    state.armed = false
    state.height = Math.max(groundedY, currentY ?? groundedY)
    state.verticalVelocity =
      CAR_JUMP_LAUNCH_BASE + Math.abs(speed) * CAR_JUMP_LAUNCH_SPEED_SCALE
    nextSpeed *= CAR_JUMP_TAKEOFF_SPEED_MULTIPLIER
  }

  const drag = Math.min(CAR_JUMP_AIR_DRAG_PER_SECOND * deltaSeconds, 0.5)
  nextSpeed *= 1 - drag
  state.verticalVelocity -= CAR_JUMP_GRAVITY * deltaSeconds
  state.height += state.verticalVelocity * deltaSeconds

  if (state.height <= groundedY && state.verticalVelocity <= 0) {
    state.airborne = false
    state.verticalVelocity = 0
    state.height = groundedY
    if (!inZone) state.armed = true
    return { height: groundedY, speed: nextSpeed }
  }

  return { height: state.height, speed: nextSpeed }
}
