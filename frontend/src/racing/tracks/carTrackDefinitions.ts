import * as THREE from 'three'
import type { CarTrackStartGateLayoutOptions } from '../components/CarTrackStartGate'
import {
  startFinishDirection as australiaStartFinishDirection,
  startFinishPosition as australiaStartFinishPosition,
  trackCurve as australiaTrackCurve,
  trackFrames as australiaTrackFrames,
  trackLength as australiaTrackLength,
  trackSegments as australiaTrackSegments,
  GRID_SIZE as australiaGridSize,
  spatialHash as australiaSpatialHash,
  trackSamples as australiaTrackSamples
} from '../../components/foxracing/TrackData'
import {
  startFinishDirection as belgiumStartFinishDirection,
  startFinishPosition as belgiumStartFinishPosition,
  trackCurve as belgiumTrackCurve,
  trackFrames as belgiumTrackFrames,
  trackLength as belgiumTrackLength,
  trackSegments as belgiumTrackSegments,
  GRID_SIZE as belgiumGridSize,
  spatialHash as belgiumSpatialHash,
  trackSamples as belgiumTrackSamples
} from '../../components/foxracingbelgium/TrackData'
import {
  startFinishDirection as sanLuisStartFinishDirection,
  startFinishPosition as sanLuisStartFinishPosition,
  trackCurve as sanLuisTrackCurve,
  trackFrames as sanLuisTrackFrames,
  trackLength as sanLuisTrackLength,
  trackSegments as sanLuisTrackSegments,
  GRID_SIZE as sanLuisGridSize,
  spatialHash as sanLuisSpatialHash,
  trackSamples as sanLuisTrackSamples
} from '../../components/foxracingsanluis/TrackData'
import type { ImportedCarTrackAuthoringMetadata } from './importedCarTrackAuthoring'
import type { SpatialTrackIndex } from '../core/spatialTrackIndex'
import {
  createRoadCorridorTerrainHeightSampler,
  findNearestTrackSample,
  type RoadCorridorConfig,
  type TerrainHeightSampler
} from '../core/roadCorridor'
import type { CarCameraZoneConfig } from '../vehicles/carCamera'
import type { RacingQualityPresetId } from '../performance/qualitySettings'
import { getTrackMetadata, type TrackAuthoringMetadata, type TrackId } from './trackMetadata'
import { getTrackSurfaceProfile } from '../core/trackProfile'

export type BuiltInCarTrackDefinitionId = Extract<TrackId, 'australia' | 'belgium' | 'san-luis'>
export type CarTrackDefinitionId = BuiltInCarTrackDefinitionId | string
export type CarTrackDefinitionMetadata = TrackAuthoringMetadata | ImportedCarTrackAuthoringMetadata
type QualityNumberBudget = number | Partial<Record<RacingQualityPresetId, number>>

export interface CarTrackRenderBudget {
  sampledTerrain?: {
    resolution?: QualityNumberBudget
    yOffset?: number
  }
  shadows?: {
    mapSize?: QualityNumberBudget
    cameraExtent?: number
    cameraFar?: number
  }
}

export interface CarTrackDefinition {
  trackId: CarTrackDefinitionId
  metadata: CarTrackDefinitionMetadata
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGateHalfWidth: number
  trackCurve: THREE.CatmullRomCurve3
  trackFrames: any
  trackSegments: any
  trackLength: number
  spatialTrackIndex?: SpatialTrackIndex
  roadCorridor?: RoadCorridorConfig
  terrainHeightSampler?: TerrainHeightSampler
  startGateLayout?: CarTrackStartGateLayoutOptions
  manualCamera?: {
    targetYOffset?: number
    followLerp?: number
    updateControlsOnFollow?: boolean
  }
  cameraZones?: CarCameraZoneConfig[]
  renderBudget?: CarTrackRenderBudget
}

const createCarTrackDefinition = (
  definition: Omit<CarTrackDefinition, 'metadata'> & { trackId: BuiltInCarTrackDefinitionId }
): CarTrackDefinition => {
  const metadata = getTrackMetadata(definition.trackId)

  return {
    ...definition,
    metadata
  }
}

const createAustraliaNaturalTerrainHeight = (spatialIndex: SpatialTrackIndex): TerrainHeightSampler => {
  return (x, z) => {
    const nearestTrackHeight = findNearestTrackSample(spatialIndex, x, z).sample?.pos.y ?? 0
    const broadRoll = Math.sin(x * 0.0022) * Math.cos(z * 0.0019) * 6
    const midRoll = Math.sin((x + z) * 0.0045) * 3
    return nearestTrackHeight * 0.55 + broadRoll + midRoll
  }
}

const createBelgiumNaturalTerrainHeight = (spatialIndex: SpatialTrackIndex): TerrainHeightSampler => {
  return (x, z) => {
    const nearestTrackHeight = findNearestTrackSample(spatialIndex, x, z).sample?.pos.y ?? 0
    const broadRoll = Math.sin(x * 0.0018 + 0.4) * Math.cos(z * 0.0021 - 0.2) * 5
    const forestRoll = Math.sin((x - z) * 0.0038) * 2.5
    return nearestTrackHeight * 0.5 + broadRoll + forestRoll
  }
}

const createBuiltInRoadCorridor = (metadata: TrackAuthoringMetadata): RoadCorridorConfig => {
  const surfaceProfile = getTrackSurfaceProfile(metadata.road.profileKey)
  return {
    roadWidth: surfaceProfile.trackWidth,
    shoulderWidth: surfaceProfile.shoulderWidth,
    blendDistance: metadata.terrain.roadBlendDistance,
    roadClearance: metadata.terrain.roadClearance
  }
}

const australiaSpatialIndex: SpatialTrackIndex = {
  gridSize: australiaGridSize,
  samples: australiaTrackSamples,
  hash: australiaSpatialHash
}
const australiaMetadata = getTrackMetadata('australia')
const australiaRoadCorridor: RoadCorridorConfig = {
  ...createBuiltInRoadCorridor(australiaMetadata),
  shoulderWidth: 56,
  blendDistance: 72
}
const australiaTerrainHeightSampler = createRoadCorridorTerrainHeightSampler(
  australiaSpatialIndex,
  australiaRoadCorridor,
  createAustraliaNaturalTerrainHeight(australiaSpatialIndex)
)
const belgiumSpatialIndex: SpatialTrackIndex = {
  gridSize: belgiumGridSize,
  samples: belgiumTrackSamples,
  hash: belgiumSpatialHash
}
const belgiumMetadata = getTrackMetadata('belgium')
const belgiumRoadCorridor: RoadCorridorConfig = {
  ...createBuiltInRoadCorridor(belgiumMetadata),
  shoulderWidth: 56,
  blendDistance: 72
}
const belgiumTerrainHeightSampler = createRoadCorridorTerrainHeightSampler(
  belgiumSpatialIndex,
  belgiumRoadCorridor,
  createBelgiumNaturalTerrainHeight(belgiumSpatialIndex)
)

export const australiaCarTrackDefinition: CarTrackDefinition = createCarTrackDefinition({
  trackId: 'australia',
  startFinishPosition: australiaStartFinishPosition,
  startFinishDirection: australiaStartFinishDirection,
  startingGateHalfWidth: 10,
  trackCurve: australiaTrackCurve,
  trackFrames: australiaTrackFrames,
  trackSegments: australiaTrackSegments,
  trackLength: australiaTrackLength,
  spatialTrackIndex: australiaSpatialIndex,
  roadCorridor: australiaRoadCorridor,
  terrainHeightSampler: australiaTerrainHeightSampler,
  manualCamera: {
    targetYOffset: 0.15,
    followLerp: 0.2,
    updateControlsOnFollow: true
  },
  renderBudget: {
    sampledTerrain: {
      resolution: {
        low: 180,
        medium: 260,
        high: 340,
        ultra: 420
      },
      yOffset: -0.18
    },
    shadows: {
      mapSize: {
        low: 1024,
        medium: 2048,
        high: 4096,
        ultra: 4096
      },
      cameraExtent: 1800,
      cameraFar: 3200
    }
  }
})

export const belgiumCarTrackDefinition: CarTrackDefinition = createCarTrackDefinition({
  trackId: 'belgium',
  startFinishPosition: belgiumStartFinishPosition,
  startFinishDirection: belgiumStartFinishDirection,
  startingGateHalfWidth: 10,
  trackCurve: belgiumTrackCurve,
  trackFrames: belgiumTrackFrames,
  trackSegments: belgiumTrackSegments,
  trackLength: belgiumTrackLength,
  spatialTrackIndex: belgiumSpatialIndex,
  roadCorridor: belgiumRoadCorridor,
  terrainHeightSampler: belgiumTerrainHeightSampler,
  manualCamera: {
    targetYOffset: 0.15,
    followLerp: 0.2,
    updateControlsOnFollow: true
  },
  renderBudget: {
    sampledTerrain: {
      resolution: {
        low: 180,
        medium: 260,
        high: 340,
        ultra: 420
      },
      yOffset: -0.18
    },
    shadows: {
      mapSize: {
        low: 1024,
        medium: 2048,
        high: 4096,
        ultra: 4096
      },
      cameraExtent: 1800,
      cameraFar: 3200
    }
  }
})

export const sanLuisCarTrackDefinition: CarTrackDefinition = createCarTrackDefinition({
  trackId: 'san-luis',
  startFinishPosition: sanLuisStartFinishPosition,
  startFinishDirection: sanLuisStartFinishDirection,
  startingGateHalfWidth: 7,
  trackCurve: sanLuisTrackCurve,
  trackFrames: sanLuisTrackFrames,
  trackSegments: sanLuisTrackSegments,
  trackLength: sanLuisTrackLength,
  spatialTrackIndex: {
    gridSize: sanLuisGridSize,
    samples: sanLuisTrackSamples,
    hash: sanLuisSpatialHash
  },
  startGateLayout: {
    yPosition: 0,
    stripYOffset: 0.12,
    stripColumns: 12,
    archTopWidth: 16,
    archTopPosition: [0, 8, 0],
    alignArchTopToTrack: false
  },
  manualCamera: {
    targetYOffset: 0.15,
    followLerp: 0.1,
    updateControlsOnFollow: false
  }
})

export const CAR_TRACK_DEFINITIONS = [
  australiaCarTrackDefinition,
  belgiumCarTrackDefinition,
  sanLuisCarTrackDefinition
] as const

export const CAR_TRACK_DEFINITIONS_BY_ID: Record<BuiltInCarTrackDefinitionId, CarTrackDefinition> = {
  australia: australiaCarTrackDefinition,
  belgium: belgiumCarTrackDefinition,
  'san-luis': sanLuisCarTrackDefinition
}

export const getCarTrackDefinition = (trackId: BuiltInCarTrackDefinitionId): CarTrackDefinition => {
  return CAR_TRACK_DEFINITIONS_BY_ID[trackId]
}
