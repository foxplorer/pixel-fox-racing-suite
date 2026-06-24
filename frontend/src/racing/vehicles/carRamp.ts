/**
 * Opt-in ramp surface field for cars driving over raised launch ramps (e.g. the
 * takeoff/landing ramps at the Volcanoes lava pits). This is the *surface* half of
 * the jump system — `carJump.ts` owns the airborne arc, this owns the climb up to
 * the lip. Tracks that pass no ramp zones are completely unaffected:
 * `rampHeightAbove` returns 0 and the car follows plain terrain.
 *
 * Each `CarRampZone` describes a *single* ramp (one slab), anchored at its outer
 * (ground) end where it meets the track and oriented up-ramp toward the pit lip.
 * A query point is projected onto the ramp's up axis (`along`, 0 at the outer foot
 * rising to `rampLength` at the lip) and its across axis (distance to the side).
 * Within the footprint the height rises linearly from 0 at the foot to `lipHeight`
 * at the lip. Past the lip (`along > rampLength`) there is no surface — that's the
 * open gap the car launches over.
 *
 * A pit is flanked by two of these (one per side), each anchored on the *actual*
 * (curving) racing line so the physics climb matches the visual ramp slab exactly,
 * even where the corridor curves — rather than a single straight box along the
 * pit-center tangent, which drifts off the curve at the outer pits.
 */

export interface CarRampZone {
  /** Outer (ground) end center of the ramp, where it meets the track. World XZ. */
  x: number
  z: number
  /** Unit axis pointing up-ramp, from the outer foot toward the lip. */
  upX: number
  upZ: number
  /** Run length from the outer foot up to the lip. */
  rampLength: number
  /** Half-extent of the ramp across the direction of travel. */
  halfWidth: number
  /** Height of the lip above the outer (ground) end. */
  lipHeight: number
}

export interface CarRampFootprintHit {
  ramp: CarRampZone
  /** Distance up the ramp axis from the outer foot (0 at the foot, rampLength at the lip). */
  along: number
  /** Signed side offset from the ramp centerline. */
  across: number
}

export interface CarRampSideCollisionResult {
  blocked: boolean
  slideX?: number
  slideZ?: number
}

export const CAR_RAMP_LAUNCH_LIP_BAND = 8
export const CAR_RAMP_SIDE_COLLISION_MARGIN = 3
export const CAR_RAMP_SIDE_COLLISION_CLEARANCE = 0.2

const getRampLocalCoordinates = (
  x: number,
  z: number,
  ramp: CarRampZone
): { along: number; across: number } => {
  const dx = x - ramp.x
  const dz = z - ramp.z
  return {
    along: dx * ramp.upX + dz * ramp.upZ,
    across: dx * ramp.upZ - dz * ramp.upX
  }
}

const getRampWorldCoordinates = (
  ramp: CarRampZone,
  along: number,
  across: number
): { x: number; z: number } => {
  return {
    x: ramp.x + along * ramp.upX + across * ramp.upZ,
    z: ramp.z + along * ramp.upZ - across * ramp.upX
  }
}

export const findCarRampFootprintHit = (
  x: number,
  z: number,
  ramps: readonly CarRampZone[],
  margin = 0
): CarRampFootprintHit | null => {
  for (const ramp of ramps) {
    const { along, across } = getRampLocalCoordinates(x, z, ramp)
    if (along < -margin || along > ramp.rampLength + margin) continue
    if (Math.abs(across) > ramp.halfWidth + margin) continue
    return { ramp, along, across }
  }
  return null
}

/**
 * Additional surface height above plain terrain at (x, z) from any ramp footprint,
 * 0 when the point is off every ramp. Overlapping ramps take the max.
 */
export const rampHeightAbove = (
  x: number,
  z: number,
  ramps: readonly CarRampZone[]
): number => {
  if (ramps.length === 0) return 0
  let highest = 0
  for (const ramp of ramps) {
    const hit = findCarRampFootprintHit(x, z, [ramp])
    if (!hit) continue
    if (hit.along < 0 || hit.along > ramp.rampLength) continue
    const height = ramp.lipHeight * (hit.along / ramp.rampLength)
    if (height > highest) highest = height
  }
  return highest
}

const getRampWallSlide = ({
  nextX,
  nextZ,
  previousX,
  previousZ,
  hit,
  previousAlong,
  previousAcross,
  margin
}: {
  nextX: number
  nextZ: number
  previousX: number
  previousZ: number
  hit: CarRampFootprintHit
  previousAlong: number
  previousAcross: number
  margin: number
}): { x: number; z: number } => {
  const moveX = nextX - previousX
  const moveZ = nextZ - previousZ
  const alongDelta = moveX * hit.ramp.upX + moveZ * hit.ramp.upZ
  const acrossDelta = moveX * hit.ramp.upZ - moveZ * hit.ramp.upX
  const wallClearance = margin + CAR_RAMP_SIDE_COLLISION_CLEARANCE

  // The lip face (the gap-facing high end): block entry from beyond the lip, sliding
  // across the lip rather than stepping onto the slab over its vertical end.
  const isLipWall = previousAlong > hit.ramp.rampLength || hit.along > hit.ramp.rampLength
  if (isLipWall) {
    return getRampWorldCoordinates(
      hit.ramp,
      hit.ramp.rampLength + wallClearance,
      previousAcross + acrossDelta
    )
  }

  const sideSign = Math.sign(hit.across || previousAcross || 1)
  return getRampWorldCoordinates(
    hit.ramp,
    previousAlong + alongDelta,
    sideSign * (hit.ramp.halfWidth + wallClearance)
  )
}

export const resolveCarRampSideCollision = ({
  previousX,
  previousZ,
  nextX,
  nextZ,
  ramps,
  margin = CAR_RAMP_SIDE_COLLISION_MARGIN
}: {
  previousX: number
  previousZ: number
  nextX: number
  nextZ: number
  ramps: readonly CarRampZone[]
  margin?: number
}): CarRampSideCollisionResult => {
  const nextHit = findCarRampFootprintHit(nextX, nextZ, ramps, margin)
  if (!nextHit) return { blocked: false }

  // Already on this ramp last frame → free movement within the slab.
  const previousHit = findCarRampFootprintHit(previousX, previousZ, [nextHit.ramp])
  if (previousHit) return { blocked: false }

  const previous = getRampLocalCoordinates(previousX, previousZ, nextHit.ramp)
  // Driving up onto the ramp from its outer foot (the track side) is the intended
  // entry — allow it.
  const enteredFromOuterFoot =
    previous.along < 0 && Math.abs(previous.across) <= nextHit.ramp.halfWidth + margin
  if (enteredFromOuterFoot) return { blocked: false }

  const slide = getRampWallSlide({
    nextX,
    nextZ,
    previousX,
    previousZ,
    hit: nextHit,
    previousAlong: previous.along,
    previousAcross: previous.across,
    margin
  })
  return { blocked: true, slideX: slide.x, slideZ: slide.z }
}

export const isCarRampLipLaunchTransition = ({
  previousX,
  previousZ,
  nextX,
  nextZ,
  ramps,
  lipBand = CAR_RAMP_LAUNCH_LIP_BAND
}: {
  previousX: number
  previousZ: number
  nextX: number
  nextZ: number
  ramps: readonly CarRampZone[]
  lipBand?: number
}): boolean => {
  for (const ramp of ramps) {
    const previous = getRampLocalCoordinates(previousX, previousZ, ramp)
    if (Math.abs(previous.across) > ramp.halfWidth) continue
    // Must be cresting the lip: within the top band of the slab last frame...
    if (previous.along < ramp.rampLength - lipBand || previous.along > ramp.rampLength) continue

    const next = getRampLocalCoordinates(nextX, nextZ, ramp)
    if (Math.abs(next.across) > ramp.halfWidth) continue
    // ...and stepping out past the lip into the open gap this frame.
    if (next.along > ramp.rampLength) return true
  }

  return false
}
