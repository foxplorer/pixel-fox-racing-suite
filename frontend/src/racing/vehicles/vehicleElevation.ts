export const FLAT_VEHICLE_RIDE_HEIGHT = 0.01
export const FLAT_CAR_MODEL_HEIGHT_OFFSET = 0.05

export const getFlatVehicleHeight = (): number => FLAT_VEHICLE_RIDE_HEIGHT

export const getFlatVehicleHeightAtPosition = (
  _x: number,
  _z: number,
  _currentY?: number,
  _trackT?: number
): number => FLAT_VEHICLE_RIDE_HEIGHT

export const getFlatVehicleTargetHeight = (vehicleHeightOffset: number): number => {
  return FLAT_VEHICLE_RIDE_HEIGHT + vehicleHeightOffset
}

export interface SafeVehicleSurfaceHeightOptions {
  sampledSurfaceHeight: number
  currentVehicleY: number
  vehicleHeightOffset: number
  minSurfaceHeight?: number
  maxSurfaceHeight?: number
}

export const getSafeVehicleSurfaceHeight = ({
  sampledSurfaceHeight,
  currentVehicleY,
  vehicleHeightOffset,
  minSurfaceHeight = 0.1,
  maxSurfaceHeight = 1000
}: SafeVehicleSurfaceHeightOptions): number => {
  if (
    Number.isFinite(sampledSurfaceHeight) &&
    sampledSurfaceHeight > minSurfaceHeight &&
    sampledSurfaceHeight < maxSurfaceHeight
  ) {
    return sampledSurfaceHeight
  }

  if (Number.isFinite(currentVehicleY) && currentVehicleY > minSurfaceHeight) {
    return currentVehicleY - vehicleHeightOffset
  }

  return minSurfaceHeight
}

export const getSafeVehicleTargetHeight = (options: SafeVehicleSurfaceHeightOptions): number => {
  return getSafeVehicleSurfaceHeight(options) + options.vehicleHeightOffset
}

export interface ResolveVehicleSurfaceYOptions {
  currentY: number
  targetY: number
  deltaSeconds: number
  snapUpToTarget?: boolean
  snapDownDistance?: number
  smoothDownDistance?: number
  smoothingRate?: number
}

export const resolveVehicleSurfaceY = ({
  currentY,
  targetY,
  deltaSeconds,
  snapUpToTarget = false,
  snapDownDistance = 1,
  smoothDownDistance = 0.3,
  smoothingRate = 20
}: ResolveVehicleSurfaceYOptions): number => {
  if (snapUpToTarget && currentY < targetY) {
    return targetY
  }

  if (currentY > targetY + snapDownDistance) {
    return targetY
  }

  if (currentY > targetY + smoothDownDistance) {
    const smoothing = 1 - Math.exp(-deltaSeconds * smoothingRate)
    return currentY + (targetY - currentY) * smoothing
  }

  return currentY
}

export const resolveFlatCarNextPositionY = ({
  currentY,
  currentVehicleY,
  deltaSeconds
}: {
  currentY: number
  currentVehicleY: number
  deltaSeconds: number
}): number => {
  const sampledSurfaceHeight = getFlatVehicleHeight()
  const targetY = getSafeVehicleTargetHeight({
    sampledSurfaceHeight,
    currentVehicleY,
    vehicleHeightOffset: FLAT_CAR_MODEL_HEIGHT_OFFSET
  })

  return resolveVehicleSurfaceY({
    currentY,
    targetY,
    deltaSeconds,
    snapUpToTarget: true
  })
}

export interface VehicleHeightSampler {
  (x: number, z: number, currentY?: number, trackT?: number): number
}

export interface VehiclePlanarDirection {
  x: number
  z: number
}

export interface VehicleVisualTilt {
  pitch: number
  roll: number
}

export interface VehicleVisualTiltOptions {
  x: number
  z: number
  currentY?: number
  trackT?: number
  forward: VehiclePlanarDirection
  right: VehiclePlanarDirection
  getHeightAtPosition: VehicleHeightSampler
  longitudinalSampleDistance?: number
  lateralSampleDistance?: number
  maxPitchRadians?: number
  maxRollRadians?: number
}

export interface SmoothVehicleVisualTiltOptions {
  currentPitch: number
  currentRoll: number
  targetPitch: number
  targetRoll: number
  deltaSeconds: number
  smoothingRate?: number
}

export const DEFAULT_VEHICLE_VISUAL_TILT_LONGITUDINAL_SAMPLE_DISTANCE = 4.5
export const DEFAULT_VEHICLE_VISUAL_TILT_LATERAL_SAMPLE_DISTANCE = 4
export const DEFAULT_VEHICLE_VISUAL_TILT_MAX_PITCH_RADIANS = 0.24
export const DEFAULT_VEHICLE_VISUAL_TILT_MAX_ROLL_RADIANS = 0.18
export const DEFAULT_VEHICLE_VISUAL_TILT_SMOOTHING_RATE = 9

const clampFinite = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return 0
  if (Math.abs(value) < 0.000001) return 0
  return Math.min(Math.max(value, min), max)
}

const getNormalizedPlanarDirection = (
  direction: VehiclePlanarDirection
): VehiclePlanarDirection | null => {
  const length = Math.hypot(direction.x, direction.z)
  if (!Number.isFinite(length) || length <= 0.0001) {
    return null
  }

  return {
    x: direction.x / length,
    z: direction.z / length
  }
}

const getSafeSampledHeight = (
  getHeightAtPosition: VehicleHeightSampler,
  x: number,
  z: number,
  currentY: number | undefined,
  trackT: number | undefined,
  fallbackHeight: number
): number => {
  const sampledHeight = getHeightAtPosition(x, z, currentY, trackT)
  return Number.isFinite(sampledHeight) ? sampledHeight : fallbackHeight
}

export const getVehicleVisualTilt = ({
  x,
  z,
  currentY,
  trackT,
  forward,
  right,
  getHeightAtPosition,
  longitudinalSampleDistance = DEFAULT_VEHICLE_VISUAL_TILT_LONGITUDINAL_SAMPLE_DISTANCE,
  lateralSampleDistance = DEFAULT_VEHICLE_VISUAL_TILT_LATERAL_SAMPLE_DISTANCE,
  maxPitchRadians = DEFAULT_VEHICLE_VISUAL_TILT_MAX_PITCH_RADIANS,
  maxRollRadians = DEFAULT_VEHICLE_VISUAL_TILT_MAX_ROLL_RADIANS
}: VehicleVisualTiltOptions): VehicleVisualTilt => {
  const normalizedForward = getNormalizedPlanarDirection(forward)
  const normalizedRight = getNormalizedPlanarDirection(right)
  if (!normalizedForward || !normalizedRight || longitudinalSampleDistance <= 0 || lateralSampleDistance <= 0) {
    return { pitch: 0, roll: 0 }
  }

  const centerHeight = getSafeSampledHeight(
    getHeightAtPosition,
    x,
    z,
    currentY,
    trackT,
    Number.isFinite(currentY) ? currentY ?? 0 : 0
  )
  const frontHeight = getSafeSampledHeight(
    getHeightAtPosition,
    x + normalizedForward.x * longitudinalSampleDistance,
    z + normalizedForward.z * longitudinalSampleDistance,
    currentY,
    trackT,
    centerHeight
  )
  const backHeight = getSafeSampledHeight(
    getHeightAtPosition,
    x - normalizedForward.x * longitudinalSampleDistance,
    z - normalizedForward.z * longitudinalSampleDistance,
    currentY,
    trackT,
    centerHeight
  )
  const rightHeight = getSafeSampledHeight(
    getHeightAtPosition,
    x + normalizedRight.x * lateralSampleDistance,
    z + normalizedRight.z * lateralSampleDistance,
    currentY,
    trackT,
    centerHeight
  )
  const leftHeight = getSafeSampledHeight(
    getHeightAtPosition,
    x - normalizedRight.x * lateralSampleDistance,
    z - normalizedRight.z * lateralSampleDistance,
    currentY,
    trackT,
    centerHeight
  )

  return {
    pitch: clampFinite(-Math.atan2(frontHeight - backHeight, longitudinalSampleDistance * 2), -maxPitchRadians, maxPitchRadians),
    roll: clampFinite(Math.atan2(rightHeight - leftHeight, lateralSampleDistance * 2), -maxRollRadians, maxRollRadians)
  }
}

export const smoothVehicleVisualTilt = ({
  currentPitch,
  currentRoll,
  targetPitch,
  targetRoll,
  deltaSeconds,
  smoothingRate = DEFAULT_VEHICLE_VISUAL_TILT_SMOOTHING_RATE
}: SmoothVehicleVisualTiltOptions): VehicleVisualTilt => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || !Number.isFinite(smoothingRate) || smoothingRate <= 0) {
    return {
      pitch: Number.isFinite(currentPitch) ? currentPitch : 0,
      roll: Number.isFinite(currentRoll) ? currentRoll : 0
    }
  }

  const smoothing = 1 - Math.exp(-deltaSeconds * smoothingRate)
  const safeCurrentPitch = Number.isFinite(currentPitch) ? currentPitch : 0
  const safeCurrentRoll = Number.isFinite(currentRoll) ? currentRoll : 0
  const safeTargetPitch = Number.isFinite(targetPitch) ? targetPitch : 0
  const safeTargetRoll = Number.isFinite(targetRoll) ? targetRoll : 0

  return {
    pitch: safeCurrentPitch + (safeTargetPitch - safeCurrentPitch) * smoothing,
    roll: safeCurrentRoll + (safeTargetRoll - safeCurrentRoll) * smoothing
  }
}
