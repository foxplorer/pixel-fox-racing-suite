import type { TrackProfileKey } from '../core/trackProfile'
import type {
  BarrierPresetKey,
  CameraPresetKey,
  ElevationDataSource,
  HeightProviderKey,
  LayoutSource,
  SceneryPresetKey,
  TrackAssetStatus,
  TrackAuthoringMetadata,
  TrackEnvironment
} from './trackMetadata'

export type ImportedCarTrackId = string

export interface ImportedCarTrackGeoJsonInput {
  jsonPath: string
  worldSize?: number
  sourceUrl?: string
  sourceNotes?: string
  coordinateElevationScale?: number
  coordinateElevationOffset?: number
}

export interface ImportedCarTrackStartGateInput {
  // Usually authored from an in-game position/direction logger after first import.
  // Do not assume GeoJSON first point, feature name, or bbox gives a good race start.
  position: readonly [number, number, number]
  direction: readonly [number, number, number]
  gateWidth: number
  lapCrossingWidth?: number
  lapCrossingDepth?: number
}

export interface ImportedCarTrackSceneryInput {
  preset: SceneryPresetKey
  file?: string
  barriers?: BarrierPresetKey
  adBoards?: BarrierPresetKey
  treePlacement?: TrackAuthoringMetadata['scenery']['treePlacement']
  sceneryZonesStatus?: TrackAssetStatus
}

export interface ImportedCarTrackTerrainInput {
  heightProvider?: HeightProviderKey
  currentElevationSource?: ElevationDataSource
  plannedElevationSource?: ElevationDataSource
  roadBlendDistance?: number
  roadClearance?: number
  notes?: string
}

export interface ImportedCarTrackAuthoringInput {
  id: ImportedCarTrackId
  displayName: string
  location?: string
  environment?: TrackEnvironment
  layoutSource?: LayoutSource
  geoJson: ImportedCarTrackGeoJsonInput
  roadProfile?: TrackProfileKey
  startGate: ImportedCarTrackStartGateInput
  scenery: ImportedCarTrackSceneryInput
  terrain?: ImportedCarTrackTerrainInput
  cameraPreset?: CameraPresetKey
  targetMobileFps?: number
  targetDesktopFps?: number
  spatialIndex?: {
    gridSize?: number
    samples?: number
  }
  notes?: string
}

export type ImportedCarTrackAuthoringMetadata = Omit<TrackAuthoringMetadata, 'id'> & {
  id: ImportedCarTrackId
  contributorSceneryFile?: string
  geoJsonElevation?: {
    coordinateElevationScale: number
    coordinateElevationOffset: number
  }
}

export const DEFAULT_IMPORTED_CAR_TRACK_WORLD_SIZE = 2500
export const DEFAULT_IMPORTED_CAR_TRACK_GATE_DEPTH = 4
export const DEFAULT_IMPORTED_CAR_TRACK_ROAD_BLEND_DISTANCE = 30
export const DEFAULT_IMPORTED_CAR_TRACK_ROAD_CLEARANCE = 0.1
export const DEFAULT_IMPORTED_CAR_TRACK_SPATIAL_GRID_SIZE = 50
export const DEFAULT_IMPORTED_CAR_TRACK_SPATIAL_SAMPLES = 2200

const CAR_CAMERA_MODES: TrackAuthoringMetadata['camera']['availableModes'] = [
  'simple',
  'smooth',
  'damped',
  'targetsmooth',
  'velocity'
]

const isFiniteNumber = (value: number): boolean => Number.isFinite(value)

const vectorLength = (vector: readonly [number, number, number]): number => {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export const validateImportedCarTrackAuthoringInput = (
  input: ImportedCarTrackAuthoringInput
): string[] => {
  const errors: string[] = []

  if (!input.id.trim()) errors.push('Track id is required.')
  if (!input.displayName.trim()) errors.push('Track display name is required.')
  if (!input.geoJson.jsonPath.trim()) errors.push('GeoJSON .json path is required.')
  if (input.geoJson.jsonPath && !input.geoJson.jsonPath.endsWith('.json')) {
    errors.push('GeoJSON path must point to a .json file.')
  }

  if (!input.startGate.position.every(isFiniteNumber)) {
    errors.push('Start gate position must contain finite x/y/z numbers.')
  }

  if (!input.startGate.direction.every(isFiniteNumber) || vectorLength(input.startGate.direction) <= 0.0001) {
    errors.push('Start gate direction must be a non-zero finite vector.')
  }

  if (!Number.isFinite(input.startGate.gateWidth) || input.startGate.gateWidth <= 0) {
    errors.push('Start gate width must be greater than zero.')
  }

  if (input.startGate.lapCrossingWidth !== undefined && input.startGate.lapCrossingWidth <= 0) {
    errors.push('Lap crossing width must be greater than zero when provided.')
  }

  if (input.startGate.lapCrossingDepth !== undefined && input.startGate.lapCrossingDepth <= 0) {
    errors.push('Lap crossing depth must be greater than zero when provided.')
  }

  if (input.geoJson.worldSize !== undefined && input.geoJson.worldSize <= 0) {
    errors.push('GeoJSON world size must be greater than zero when provided.')
  }

  return errors
}

export const createImportedCarTrackAuthoringMetadata = (
  input: ImportedCarTrackAuthoringInput
): ImportedCarTrackAuthoringMetadata => {
  const errors = validateImportedCarTrackAuthoringInput(input)
  if (errors.length > 0) {
    throw new Error(`Invalid imported car track authoring input: ${errors.join(' ')}`)
  }

  const roadProfile = input.roadProfile ?? 'standard-car'
  const lapCrossingWidth = input.startGate.lapCrossingWidth ?? input.startGate.gateWidth
  const lapCrossingDepth = input.startGate.lapCrossingDepth ?? DEFAULT_IMPORTED_CAR_TRACK_GATE_DEPTH
  const heightProvider = input.terrain?.heightProvider ?? 'constant'
  const currentElevationSource = input.terrain?.currentElevationSource ?? 'none'
  const plannedElevationSource = input.terrain?.plannedElevationSource ?? 'sampled-real-world'

  return {
    id: input.id,
    displayName: input.displayName,
    location: input.location ?? input.displayName,
    environment: input.environment ?? 'forest',
    supportedVehicleModes: ['car'],
    handlingModels: ['shared-car'],
    layoutSource: input.layoutSource ?? 'custom',
    layout: {
      kind: 'geojson-circuit',
      curveSource: input.geoJson.jsonPath,
      worldSize: input.geoJson.worldSize ?? DEFAULT_IMPORTED_CAR_TRACK_WORLD_SIZE,
      sourceUrl: input.geoJson.sourceUrl,
      sourceNotes: input.geoJson.sourceNotes ?? 'Imported contributor GeoJSON track.'
    },
    road: {
      profileKey: roadProfile,
      surface: 'asphalt',
      supportsVariableWidth: false,
      edgeGeometryStatus: 'planned'
    },
    start: {
      method: 'explicit-pose',
      direction: 'explicit',
      position: input.startGate.position,
      directionVector: input.startGate.direction,
      gateWidth: input.startGate.gateWidth,
      lapCrossingWidth,
      lapCrossingDepth
    },
    terrain: {
      elevationMode: currentElevationSource === 'none' ? 'flat' : 'hilly',
      heightProvider,
      currentElevationSource,
      plannedElevationSource,
      roadCorridorRequired: true,
      roadBlendDistance: input.terrain?.roadBlendDistance ?? DEFAULT_IMPORTED_CAR_TRACK_ROAD_BLEND_DISTANCE,
      roadClearance: input.terrain?.roadClearance ?? DEFAULT_IMPORTED_CAR_TRACK_ROAD_CLEARANCE,
      notes: input.terrain?.notes ?? 'Imported car track defaults flat, with road-corridor terrain support reserved for height data.'
    },
    scenery: {
      preset: input.scenery.preset,
      barriers: input.scenery.barriers ?? 'none',
      adBoards: input.scenery.adBoards ?? 'none',
      treePlacement: input.scenery.treePlacement ?? 'track-distance',
      sceneryZonesStatus: input.scenery.sceneryZonesStatus ?? 'planned'
    },
    wallCollision: {
      mode: input.scenery.barriers === 'centerline-ad-boards' ? 'visual-barriers' : 'none',
      centerlineOffsetExtra: 0,
      collisionInset: 0,
      nearTrackDistance: 50,
      treeBuffer: 5,
      notes: 'Imported car tracks default to scenery/collision props, not invisible continuous walls.'
    },
    lapValidation: {
      minLapDistanceRatio: 0.9,
      requiresReachedEnd: false,
      wrongWayCrossingRejected: true,
      sectorCount: 3,
      checkpointStatus: 'planned'
    },
    camera: {
      defaultPreset: input.cameraPreset ?? 'car-standard',
      availableModes: CAR_CAMERA_MODES
    },
    performance: {
      targetMobileFps: input.targetMobileFps ?? 30,
      targetDesktopFps: input.targetDesktopFps ?? 60,
      lodStatus: 'planned'
    },
    spatialIndex: {
      gridSize: input.spatialIndex?.gridSize ?? DEFAULT_IMPORTED_CAR_TRACK_SPATIAL_GRID_SIZE,
      samples: input.spatialIndex?.samples ?? DEFAULT_IMPORTED_CAR_TRACK_SPATIAL_SAMPLES
    },
    notes: input.notes ?? 'Contributor-imported car track draft.',
    contributorSceneryFile: input.scenery.file,
    geoJsonElevation: {
      coordinateElevationScale: input.geoJson.coordinateElevationScale ?? 1,
      coordinateElevationOffset: input.geoJson.coordinateElevationOffset ?? 0
    }
  }
}
