import type { SpatialTrackIndex, TrackSample } from './spatialTrackIndex'
import { findNearestTrackSample } from './spatialTrackIndex'

export type RoadCorridorConfig = {
  roadWidth: number
  shoulderWidth: number
  blendDistance: number
  roadClearance?: number
}

export type RoadCorridorInfluence = {
  sample: TrackSample | null
  distanceFromCenter: number
  roadHeight: number
  terrainHeight: number
  finalHeight: number
  roadInfluence: number
  shoulderInfluence: number
  blendInfluence: number
  zone: 'road' | 'shoulder' | 'blend' | 'terrain'
}

export type LegacyRoadHeightInfluence = {
  height: number
  factor: number
}

export type TerrainHeightSampler = (x: number, z: number) => number

export { findNearestTrackSample }

export const smoothstep = (value: number): number => {
  const t = Math.min(Math.max(value, 0), 1)
  return t * t * (3 - 2 * t)
}

export const getRoadCorridorInfluence = (
  index: SpatialTrackIndex,
  x: number,
  z: number,
  terrainHeight: number,
  config: RoadCorridorConfig
): RoadCorridorInfluence => {
  const { sample, distanceSq } = findNearestTrackSample(index, x, z)
  const roadClearance = config.roadClearance ?? 0

  if (!sample) {
    return {
      sample: null,
      distanceFromCenter: Infinity,
      roadHeight: terrainHeight,
      terrainHeight,
      finalHeight: terrainHeight,
      roadInfluence: 0,
      shoulderInfluence: 0,
      blendInfluence: 0,
      zone: 'terrain'
    }
  }

  const distanceFromCenter = Math.sqrt(distanceSq)
  const halfRoad = config.roadWidth / 2
  const shoulderEnd = halfRoad + config.shoulderWidth
  const blendEnd = shoulderEnd + config.blendDistance
  const roadHeight = sample.pos.y + roadClearance

  if (distanceFromCenter <= halfRoad) {
    return {
      sample,
      distanceFromCenter,
      roadHeight,
      terrainHeight,
      finalHeight: roadHeight,
      roadInfluence: 1,
      shoulderInfluence: 0,
      blendInfluence: 0,
      zone: 'road'
    }
  }

  if (distanceFromCenter <= shoulderEnd) {
    return {
      sample,
      distanceFromCenter,
      roadHeight,
      terrainHeight,
      finalHeight: roadHeight,
      roadInfluence: 1,
      shoulderInfluence: 1,
      blendInfluence: 0,
      zone: 'shoulder'
    }
  }

  if (distanceFromCenter <= blendEnd) {
    const rawT = (distanceFromCenter - shoulderEnd) / Math.max(config.blendDistance, 0.0001)
    const terrainT = smoothstep(rawT)
    const roadInfluence = 1 - terrainT

    return {
      sample,
      distanceFromCenter,
      roadHeight,
      terrainHeight,
      finalHeight: roadHeight * roadInfluence + terrainHeight * terrainT,
      roadInfluence,
      shoulderInfluence: 0,
      blendInfluence: roadInfluence,
      zone: 'blend'
    }
  }

  return {
    sample,
    distanceFromCenter,
    roadHeight,
    terrainHeight,
    finalHeight: terrainHeight,
    roadInfluence: 0,
    shoulderInfluence: 0,
    blendInfluence: 0,
    zone: 'terrain'
  }
}

export const createRoadCorridorTerrainHeightSampler = (
  index: SpatialTrackIndex,
  config: RoadCorridorConfig,
  getTerrainHeight: TerrainHeightSampler
): TerrainHeightSampler => {
  return (x, z) => {
    const terrainHeight = getTerrainHeight(x, z)
    return getRoadCorridorInfluence(index, x, z, terrainHeight, config).finalHeight
  }
}

export const getLegacyRoadHeightInfluence = (
  distanceFromCenter: number,
  roadHeight: number,
  config: RoadCorridorConfig,
  options: {
    flatRoadWidthMultiplier?: number
    outerWidthMultiplier?: number
    terrainHeight?: number
  } = {}
): LegacyRoadHeightInfluence => {
  const flatRoadWidthMultiplier = options.flatRoadWidthMultiplier ?? 0.8
  const outerWidthMultiplier = options.outerWidthMultiplier ?? 1.2
  const terrainHeight = options.terrainHeight ?? 0
  const halfTrack = config.roadWidth * flatRoadWidthMultiplier
  const outerEdge = (config.roadWidth + config.shoulderWidth) * outerWidthMultiplier

  if (distanceFromCenter < halfTrack) {
    return { height: roadHeight, factor: 1 }
  }

  if (distanceFromCenter < outerEdge) {
    const t = (distanceFromCenter - halfTrack) / (outerEdge - halfTrack)
    return {
      height: roadHeight,
      factor: 1 - t
    }
  }

  return { height: terrainHeight, factor: 0 }
}
