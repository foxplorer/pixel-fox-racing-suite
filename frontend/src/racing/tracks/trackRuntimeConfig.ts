import {
  getTrackSurfaceProfile,
  type TrackSurfaceProfile
} from '../core/trackProfile'
import {
  getTrackProximityConfig,
  type TrackProximityConfig
} from '../core/trackProximity'
import type { RoadCorridorConfig } from '../core/roadCorridor'
import type { CreateSpatialTrackIndexOptions } from '../core/spatialTrackIndex'
import type { StartGateDimensions } from '../core/startGate'
import { createEvenTrackSectors, type TrackSectorDefinition } from '../simulation/trackSectors'
import { getTrackMetadata, type TrackId, type TrackAuthoringMetadata } from './trackMetadata'

export interface TrackRuntimeConfig {
  metadata: TrackAuthoringMetadata
  surfaceProfile: TrackSurfaceProfile
  proximity: TrackProximityConfig
  sectors: TrackSectorDefinition[]
  lapCrossing: StartGateDimensions
  spatialIndex: Pick<CreateSpatialTrackIndexOptions, 'gridSize' | 'samples'>
  wallCollision: TrackAuthoringMetadata['wallCollision']
  worldSize?: number
  terrainMeshGrid?: TrackAuthoringMetadata['terrain']['meshGrid']
  roadCorridor: RoadCorridorConfig
}

export const getTrackRuntimeConfig = (trackId: TrackId): TrackRuntimeConfig => {
  const metadata = getTrackMetadata(trackId)
  const profileKey = metadata.road.profileKey
  const surfaceProfile = getTrackSurfaceProfile(profileKey)

  return {
    metadata,
    surfaceProfile,
    proximity: getTrackProximityConfig(profileKey),
    sectors: createEvenTrackSectors(metadata.lapValidation.sectorCount),
    lapCrossing: {
      width: metadata.start.lapCrossingWidth,
      depth: metadata.start.lapCrossingDepth
    },
    spatialIndex: metadata.spatialIndex,
    wallCollision: metadata.wallCollision,
    worldSize: metadata.layout.worldSize,
    terrainMeshGrid: metadata.terrain.meshGrid,
    roadCorridor: {
      roadWidth: surfaceProfile.trackWidth,
      shoulderWidth: surfaceProfile.shoulderWidth,
      blendDistance: metadata.terrain.roadBlendDistance,
      roadClearance: metadata.terrain.roadClearance
    }
  }
}
