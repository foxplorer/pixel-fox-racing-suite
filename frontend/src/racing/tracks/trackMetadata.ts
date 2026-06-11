import type { TrackProfileKey } from '../core/trackProfile'

export type TrackId = 'australia' | 'san-luis' | 'belgium' | 'aspen'

export type TrackEnvironment = 'city-park' | 'desert' | 'forest' | 'winter'

export type VehicleMode = 'car' | 'snowmobile'

export type HandlingModel = 'shared-car' | 'snowmobile'

export type ElevationMode = 'flat' | 'hilly'

export type LayoutSource = 'custom'

export type TrackLayoutKind = 'geojson-circuit' | 'hand-authored-spline'

export type HeightProviderKey = 'constant' | 'terrain-system' | 'future-heightfield'

export type ElevationDataSource = 'none' | 'procedural' | 'sampled-real-world' | 'authored'

export type SurfaceKey = 'asphalt' | 'snow'

export type CameraPresetKey = 'car-standard' | 'snowmobile-standard'

export type SceneryPresetKey = 'australia-park' | 'san-luis-desert' | 'belgium-forest' | 'aspen-winter'

export type BarrierPresetKey = 'centerline-ad-boards' | 'snow-track-walls' | 'none'

export type TrackAssetStatus = 'runtime-current' | 'planned'

export interface TrackLayoutMetadata {
  kind: TrackLayoutKind
  curveSource: string
  worldSize?: number
  sourceUrl?: string
  sourceNotes: string
}

export interface TrackRoadMetadata {
  profileKey: TrackProfileKey
  surface: SurfaceKey
  supportsVariableWidth: boolean
  edgeGeometryStatus: TrackAssetStatus
}

export interface TrackStartMetadata {
  method: 'curve-t' | 'derived-longest-straight' | 'explicit-pose'
  curveT?: number
  direction: 'tangent' | 'negated-tangent' | 'explicit'
  position?: readonly [number, number, number]
  directionVector?: readonly [number, number, number]
  gateWidth: number
  lapCrossingWidth: number
  lapCrossingDepth: number
}

export interface TrackTerrainMetadata {
  elevationMode: ElevationMode
  heightProvider: HeightProviderKey
  currentElevationSource: ElevationDataSource
  plannedElevationSource: ElevationDataSource
  meshGrid?: {
    segmentSize: number
    resolution: number
    renderDistance: number
  }
  roadCorridorRequired: boolean
  roadBlendDistance: number
  roadClearance: number
  notes: string
}

export interface TrackSceneryMetadata {
  preset: SceneryPresetKey
  barriers: BarrierPresetKey
  adBoards: BarrierPresetKey
  treePlacement: 'track-distance' | 'authored-zones'
  sceneryZonesStatus: TrackAssetStatus
}

export interface TrackWallCollisionMetadata {
  mode: 'none' | 'visual-barriers' | 'invisible-high-walls'
  centerlineOffsetExtra: number
  collisionInset: number
  nearTrackDistance: number
  treeBuffer: number
  notes: string
}

export interface TrackLapValidationMetadata {
  minLapDistanceRatio: number
  requiresReachedEnd: boolean
  wrongWayCrossingRejected: boolean
  sectorCount: number
  checkpointStatus: TrackAssetStatus
}

export interface TrackCameraMetadata {
  defaultPreset: CameraPresetKey
  availableModes: Array<'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'>
}

export interface TrackPerformanceMetadata {
  targetMobileFps: number
  targetDesktopFps: number
  lodStatus: TrackAssetStatus
}

export interface TrackSpatialIndexMetadata {
  gridSize: number
  samples: number
}

export interface TrackAuthoringMetadata {
  id: TrackId
  displayName: string
  location: string
  environment: TrackEnvironment
  supportedVehicleModes: VehicleMode[]
  handlingModels: HandlingModel[]
  layoutSource: LayoutSource
  layout: TrackLayoutMetadata
  road: TrackRoadMetadata
  start: TrackStartMetadata
  terrain: TrackTerrainMetadata
  scenery: TrackSceneryMetadata
  wallCollision: TrackWallCollisionMetadata
  lapValidation: TrackLapValidationMetadata
  camera: TrackCameraMetadata
  performance: TrackPerformanceMetadata
  spatialIndex: TrackSpatialIndexMetadata
  notes: string
}

const CAR_CAMERA_MODES: TrackCameraMetadata['availableModes'] = [
  'simple',
  'smooth',
  'damped',
  'targetsmooth',
  'velocity'
]

export const TRACK_METADATA: Record<TrackId, TrackAuthoringMetadata> = {
  australia: {
    id: 'australia',
    displayName: 'Australia',
    location: 'Australia',
    environment: 'city-park',
    supportedVehicleModes: ['car'],
    handlingModels: ['shared-car'],
    layoutSource: 'custom',
    layout: {
      kind: 'geojson-circuit',
      curveSource: 'frontend/src/components/foxracing/australia.source.json',
      worldSize: 2500,
      sourceNotes: 'Custom drawn GeoJSON layout generated in the route editor and normalized into a CatmullRom runtime curve.'
    },
    road: {
      profileKey: 'standard-car',
      surface: 'asphalt',
      supportsVariableWidth: false,
      edgeGeometryStatus: 'planned'
    },
    start: {
      method: 'derived-longest-straight',
      direction: 'negated-tangent',
      gateWidth: 20,
      lapCrossingWidth: 18,
      lapCrossingDepth: 4
    },
    terrain: {
      elevationMode: 'hilly',
      heightProvider: 'terrain-system',
      currentElevationSource: 'authored',
      plannedElevationSource: 'authored',
      roadCorridorRequired: true,
      roadBlendDistance: 72,
      roadClearance: 0.1,
      notes: 'Uses authored elevation values embedded in the custom GeoJSON coordinates with an expanded terrain blend around the road corridor.'
    },
    scenery: {
      preset: 'australia-park',
      barriers: 'centerline-ad-boards',
      adBoards: 'centerline-ad-boards',
      treePlacement: 'track-distance',
      sceneryZonesStatus: 'planned'
    },
    wallCollision: {
      mode: 'visual-barriers',
      centerlineOffsetExtra: 0,
      collisionInset: 0,
      nearTrackDistance: 50,
      treeBuffer: 5,
      notes: 'Current car collision is against board geometry rather than a separate invisible wall.'
    },
    lapValidation: {
      minLapDistanceRatio: 0.9,
      requiresReachedEnd: false,
      wrongWayCrossingRejected: true,
      sectorCount: 3,
      checkpointStatus: 'planned'
    },
    camera: {
      defaultPreset: 'car-standard',
      availableModes: CAR_CAMERA_MODES
    },
    performance: {
      targetMobileFps: 30,
      targetDesktopFps: 60,
      lodStatus: 'planned'
    },
    spatialIndex: {
      gridSize: 50,
      samples: 2200
    },
    notes: 'Custom drawn country-themed in-game version using the standard car track profile.'
  },
  'san-luis': {
    id: 'san-luis',
    displayName: 'San Luis',
    location: 'San Luis',
    environment: 'desert',
    supportedVehicleModes: ['car'],
    handlingModels: ['shared-car'],
    layoutSource: 'custom',
    layout: {
      kind: 'hand-authored-spline',
      curveSource: 'frontend/src/components/foxracingsanluis/TrackData.ts',
      sourceNotes: 'Custom control points authored directly in the game code.'
    },
    road: {
      profileKey: 'san-luis',
      surface: 'asphalt',
      supportsVariableWidth: false,
      edgeGeometryStatus: 'planned'
    },
    start: {
      method: 'explicit-pose',
      direction: 'explicit',
      position: [0, 0.1, 0],
      directionVector: [0, 0, 1],
      gateWidth: 12,
      lapCrossingWidth: 12,
      lapCrossingDepth: 4
    },
    terrain: {
      elevationMode: 'flat',
      heightProvider: 'constant',
      currentElevationSource: 'none',
      plannedElevationSource: 'authored',
      roadCorridorRequired: true,
      roadBlendDistance: 30,
      roadClearance: 0.1,
      notes: 'Narrow custom track; future elevation should keep the road ribbon authored first.'
    },
    scenery: {
      preset: 'san-luis-desert',
      barriers: 'none',
      adBoards: 'none',
      treePlacement: 'track-distance',
      sceneryZonesStatus: 'planned'
    },
    wallCollision: {
      mode: 'none',
      centerlineOffsetExtra: 0,
      collisionInset: 0,
      nearTrackDistance: 50,
      treeBuffer: 5,
      notes: 'No separate track wall system currently authored for San Luis.'
    },
    lapValidation: {
      minLapDistanceRatio: 0.9,
      requiresReachedEnd: true,
      wrongWayCrossingRejected: true,
      sectorCount: 3,
      checkpointStatus: 'planned'
    },
    camera: {
      defaultPreset: 'car-standard',
      availableModes: CAR_CAMERA_MODES
    },
    performance: {
      targetMobileFps: 30,
      targetDesktopFps: 60,
      lodStatus: 'planned'
    },
    spatialIndex: {
      gridSize: 50,
      samples: 2200
    },
    notes: 'Custom, narrower car track. Keep the layout identity while sharing car behavior.'
  },
  belgium: {
    id: 'belgium',
    displayName: 'Belgium',
    location: 'Belgium',
    environment: 'forest',
    supportedVehicleModes: ['car'],
    handlingModels: ['shared-car'],
    layoutSource: 'custom',
    layout: {
      kind: 'geojson-circuit',
      curveSource: 'frontend/src/components/foxracing/belgium.source.json',
      worldSize: 2500,
      sourceNotes: 'Custom drawn GeoJSON layout generated in the route editor and normalized into a CatmullRom runtime curve.'
    },
    road: {
      profileKey: 'standard-car',
      surface: 'asphalt',
      supportsVariableWidth: false,
      edgeGeometryStatus: 'planned'
    },
    start: {
      method: 'curve-t',
      curveT: 0.9845,
      direction: 'negated-tangent',
      gateWidth: 20,
      lapCrossingWidth: 18,
      lapCrossingDepth: 4
    },
    terrain: {
      elevationMode: 'hilly',
      heightProvider: 'terrain-system',
      currentElevationSource: 'authored',
      plannedElevationSource: 'authored',
      roadCorridorRequired: true,
      roadBlendDistance: 72,
      roadClearance: 0.1,
      notes: 'Uses authored elevation values embedded in the custom GeoJSON coordinates with an expanded terrain blend around the road corridor.'
    },
    scenery: {
      preset: 'belgium-forest',
      barriers: 'centerline-ad-boards',
      adBoards: 'centerline-ad-boards',
      treePlacement: 'track-distance',
      sceneryZonesStatus: 'planned'
    },
    wallCollision: {
      mode: 'visual-barriers',
      centerlineOffsetExtra: 4,
      collisionInset: 0,
      nearTrackDistance: 50,
      treeBuffer: 5,
      notes: 'Current car collision is against board geometry rather than a separate invisible wall.'
    },
    lapValidation: {
      minLapDistanceRatio: 0.9,
      requiresReachedEnd: false,
      wrongWayCrossingRejected: true,
      sectorCount: 3,
      checkpointStatus: 'planned'
    },
    camera: {
      defaultPreset: 'car-standard',
      availableModes: CAR_CAMERA_MODES
    },
    performance: {
      targetMobileFps: 30,
      targetDesktopFps: 60,
      lodStatus: 'planned'
    },
    spatialIndex: {
      gridSize: 50,
      samples: 2200
    },
    notes: 'Flat Belgium country-themed in-game layout using the standard car track profile.'
  },
  aspen: {
    id: 'aspen',
    displayName: 'Aspen',
    location: 'Aspen',
    environment: 'winter',
    supportedVehicleModes: ['snowmobile'],
    handlingModels: ['snowmobile'],
    layoutSource: 'custom',
    layout: {
      kind: 'geojson-circuit',
      curveSource: 'frontend/src/components/snowmobilerace/aspen.source.json',
      worldSize: 2500,
      sourceNotes: 'Custom browser-drawn mountain hairpin layout adapted into a winter Aspen snowmobile track.'
    },
    road: {
      profileKey: 'snow',
      surface: 'snow',
      supportsVariableWidth: false,
      edgeGeometryStatus: 'planned'
    },
    start: {
      method: 'curve-t',
      curveT: 0.885,
      direction: 'negated-tangent',
      gateWidth: 20,
      lapCrossingWidth: 18,
      lapCrossingDepth: 4
    },
    terrain: {
      elevationMode: 'hilly',
      heightProvider: 'terrain-system',
      currentElevationSource: 'procedural',
      plannedElevationSource: 'procedural',
      meshGrid: {
        segmentSize: 400,
        resolution: 80,
        renderDistance: 2000
      },
      roadCorridorRequired: true,
      roadBlendDistance: 30,
      roadClearance: 0.3,
      notes: 'Custom route shape rides on the procedural snow terrain system so sled physics and rendered snow stay aligned.'
    },
    scenery: {
      preset: 'aspen-winter',
      barriers: 'snow-track-walls',
      adBoards: 'centerline-ad-boards',
      treePlacement: 'track-distance',
      sceneryZonesStatus: 'planned'
    },
    wallCollision: {
      mode: 'invisible-high-walls',
      centerlineOffsetExtra: 4,
      collisionInset: 1,
      nearTrackDistance: 50,
      treeBuffer: 5,
      notes: 'Snowmobile can jump over visible boards, so the collision wall is intentionally tall/invisible while visuals stay separate.'
    },
    lapValidation: {
      minLapDistanceRatio: 0.9,
      requiresReachedEnd: false,
      wrongWayCrossingRejected: true,
      sectorCount: 3,
      checkpointStatus: 'planned'
    },
    camera: {
      defaultPreset: 'snowmobile-standard',
      availableModes: CAR_CAMERA_MODES
    },
    performance: {
      targetMobileFps: 30,
      targetDesktopFps: 60,
      lodStatus: 'planned'
    },
    spatialIndex: {
      gridSize: 50,
      samples: 2200
    },
    notes: 'Custom winter mountain hairpin layout authored as a snowmobile track.'
  }
}

export const TRACK_IDS = Object.keys(TRACK_METADATA) as TrackId[]

export const getTrackMetadata = (trackId: TrackId): TrackAuthoringMetadata => {
  return TRACK_METADATA[trackId]
}
