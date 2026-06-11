export const notifyManualCameraControlUsed = ({
  isManualCamera,
  isControlActive,
  onControlUsed
}: {
  isManualCamera: boolean
  isControlActive: boolean
  onControlUsed?: () => void
}): void => {
  if (isManualCamera && isControlActive) {
    onControlUsed?.()
  }
}

export const notifyVehiclePositionUpdate = <TPosition>({
  position,
  rotation,
  speed,
  onPositionUpdate
}: {
  position: TPosition
  rotation: number
  speed: number
  onPositionUpdate?: (position: TPosition, rotation?: number, speed?: number) => void
}): void => {
  onPositionUpdate?.(position, rotation, speed)
}

export const commitVehiclePose = <TPosition>({
  vehicle,
  position,
  rotation,
  rotationEpsilon = 0
}: {
  vehicle: {
    position: { copy(position: TPosition): unknown }
    rotation: { y: number }
  }
  position: TPosition
  rotation: number
  rotationEpsilon?: number
}): { rotationUpdated: boolean } => {
  vehicle.position.copy(position)

  if (Math.abs(vehicle.rotation.y - rotation) > rotationEpsilon) {
    vehicle.rotation.y = rotation
    return { rotationUpdated: true }
  }

  return { rotationUpdated: false }
}

export const resetVehiclePoseRefs = <TPosition>({
  position,
  x,
  y,
  z,
  rotation,
  rotationRadians,
  smoothedRotation,
  speed,
  vehicle,
  cameraRotation,
  lastCameraUpdateRotation
}: {
  position: { current: { set(x: number, y: number, z: number): unknown } & TPosition }
  x: number
  y: number
  z: number
  rotation: { current: number }
  rotationRadians: number
  smoothedRotation?: { current: number }
  speed?: { current: number }
  vehicle?: {
    position: { copy(position: TPosition): unknown }
    rotation: { y: number }
  } | null
  cameraRotation?: { current: number }
  lastCameraUpdateRotation?: { current: number }
}): void => {
  position.current.set(x, y, z)
  rotation.current = rotationRadians
  if (smoothedRotation) smoothedRotation.current = rotationRadians
  if (cameraRotation) cameraRotation.current = rotationRadians
  if (lastCameraUpdateRotation) lastCameraUpdateRotation.current = rotationRadians
  if (speed) speed.current = 0

  if (vehicle) {
    commitVehiclePose({
      vehicle,
      position: position.current,
      rotation: rotation.current
    })
  }
}

export const applyVehicleSpawnPositionOnce = <TPosition>({
  spawnPosition,
  hasAppliedSpawnPosition,
  trackCurve,
  position,
  rotation,
  smoothedRotation,
  vehicle,
  getHeightAtPosition,
  createPosition,
  findTrackPosition,
  spawnTangent,
  cameraRotation,
  lastCameraUpdateRotation
}: {
  spawnPosition?: { x: number; z: number } | null
  hasAppliedSpawnPosition: { current: boolean }
  trackCurve?: {
    getTangentAt(t: number, target: { x: number; z: number; negate(): unknown; normalize(): unknown }): unknown
  }
  position: { current: { set(x: number, y: number, z: number): unknown } & TPosition }
  rotation: { current: number }
  smoothedRotation?: { current: number }
  vehicle?: {
    position: { copy(position: TPosition): unknown }
    rotation: { y: number }
  } | null
  getHeightAtPosition: (x: number, z: number) => number
  createPosition: (x: number, y: number, z: number) => TPosition
  findTrackPosition: (position: TPosition, trackCurve: NonNullable<typeof trackCurve>) => number
  spawnTangent: { current: { x: number; z: number; negate(): unknown; normalize(): unknown } }
  cameraRotation?: { current: number }
  lastCameraUpdateRotation?: { current: number }
}): { applied: boolean; resetAppliedFlag: boolean } => {
  if (!spawnPosition) {
    hasAppliedSpawnPosition.current = false
    return { applied: false, resetAppliedFlag: true }
  }

  if (hasAppliedSpawnPosition.current || !trackCurve) {
    return { applied: false, resetAppliedFlag: false }
  }

  const trackY = getHeightAtPosition(spawnPosition.x, spawnPosition.z)
  const spawnPositionVector = createPosition(spawnPosition.x, trackY, spawnPosition.z)
  const trackT = findTrackPosition(spawnPositionVector, trackCurve)

  trackCurve.getTangentAt(trackT, spawnTangent.current)
  spawnTangent.current.negate()
  spawnTangent.current.normalize()

  const spawnRotation = Math.atan2(spawnTangent.current.x, spawnTangent.current.z)

  resetVehiclePoseRefs({
    position,
    x: spawnPosition.x,
    y: trackY,
    z: spawnPosition.z,
    rotation,
    rotationRadians: spawnRotation,
    smoothedRotation,
    vehicle,
    cameraRotation,
    lastCameraUpdateRotation
  })

  hasAppliedSpawnPosition.current = true
  return { applied: true, resetAppliedFlag: false }
}
