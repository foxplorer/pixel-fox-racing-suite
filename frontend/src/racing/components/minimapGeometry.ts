import * as THREE from 'three'

export interface MinimapWorldPosition {
  x: number
  y: number
  z: number
}

export interface MinimapCanvasPosition {
  x: number
  y: number
}

export interface MinimapTrackBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centerX: number
  centerZ: number
  range: number
}

export interface MinimapProjectionInput {
  width: number
  height: number
  bounds: MinimapTrackBounds
  padding?: number
}

export const DEFAULT_MINIMAP_TRACK_BOUNDS: MinimapTrackBounds = {
  minX: -100,
  maxX: 100,
  minZ: -100,
  maxZ: 100,
  centerX: 0,
  centerZ: 0,
  range: 200
}

export const DEFAULT_MINIMAP_TRACK_PADDING = 50
export const DEFAULT_MINIMAP_CANVAS_PADDING = 10
export const DEFAULT_MINIMAP_BOUNDS_SAMPLES = 200
export const DEFAULT_MINIMAP_TRACK_DRAW_SAMPLES = 150
export const DEFAULT_MINIMAP_POSITION_THRESHOLD = 1

export const getMinimapTrackBounds = (
  trackCurve: THREE.CatmullRomCurve3 | null | undefined,
  samples = DEFAULT_MINIMAP_BOUNDS_SAMPLES,
  padding = DEFAULT_MINIMAP_TRACK_PADDING
): MinimapTrackBounds => {
  if (!trackCurve) {
    return DEFAULT_MINIMAP_TRACK_BOUNDS
  }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (let index = 0; index <= samples; index++) {
    const point = trackCurve.getPointAt(index / samples)
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  minX -= padding
  maxX += padding
  minZ -= padding
  maxZ += padding

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const range = Math.max(maxX - minX, maxZ - minZ)

  return { minX, maxX, minZ, maxZ, centerX, centerZ, range }
}

export const worldToMinimapCanvas = (
  x: number,
  z: number,
  {
    width,
    height,
    bounds,
    padding = DEFAULT_MINIMAP_CANVAS_PADDING
  }: MinimapProjectionInput
): MinimapCanvasPosition => {
  const drawWidth = width - padding * 2
  const drawHeight = height - padding * 2
  const scale = Math.min(drawWidth, drawHeight) / bounds.range

  return {
    x: width - ((x - bounds.centerX) * scale + drawWidth / 2 + padding),
    y: height - ((z - bounds.centerZ) * scale + drawHeight / 2 + padding)
  }
}

export const hasMinimapPositionChanged = (
  nextPosition: MinimapWorldPosition | null,
  previousPosition: MinimapWorldPosition | null,
  threshold = DEFAULT_MINIMAP_POSITION_THRESHOLD
): boolean => {
  if (!nextPosition) return false
  if (!previousPosition) return true

  return (
    Math.abs(nextPosition.x - previousPosition.x) > threshold ||
    Math.abs(nextPosition.y - previousPosition.y) > threshold ||
    Math.abs(nextPosition.z - previousPosition.z) > threshold
  )
}

export interface MinimapVehicleFrameDecisionOptions {
  vehiclePosition: MinimapWorldPosition | null
  lastVehiclePosition: MinimapWorldPosition | null
  skippedFrameCount: number
  updateEveryFrames?: number
}

export interface MinimapVehicleFrameDecision {
  shouldDraw: boolean
  nextSkippedFrameCount: number
}

export const shouldDrawMinimapVehicleFrame = ({
  vehiclePosition,
  lastVehiclePosition,
  skippedFrameCount,
  updateEveryFrames = 1
}: MinimapVehicleFrameDecisionOptions): MinimapVehicleFrameDecision => {
  const normalizedUpdateEveryFrames = Math.max(1, Math.floor(updateEveryFrames))
  const vehiclePositionChanged = hasMinimapPositionChanged(vehiclePosition, lastVehiclePosition)

  if (!vehiclePositionChanged && lastVehiclePosition) {
    return {
      shouldDraw: false,
      nextSkippedFrameCount: skippedFrameCount
    }
  }

  if (vehiclePosition && lastVehiclePosition && normalizedUpdateEveryFrames > 1) {
    const nextSkippedFrameCount = skippedFrameCount + 1
    if (nextSkippedFrameCount < normalizedUpdateEveryFrames) {
      return {
        shouldDraw: false,
        nextSkippedFrameCount
      }
    }
  }

  return {
    shouldDraw: true,
    nextSkippedFrameCount: 0
  }
}
